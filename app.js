/* ============================================================
   Saint Francis - shared behavior + API client
   All backend calls live here. Endpoints mirror _worker.js exactly.
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- API client ---------------- */
  const API = "/api";

  async function apiGet(path) {
    const r = await fetch(API + path, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("Request failed (" + r.status + ")");
    return r.json();
  }
  async function apiSend(method, path, body, token) {
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(data.error || "Request failed (" + r.status + ")");
      err.status = r.status;
      throw err;
    }
    return data;
  }

  /* ---------------- Turnstile bot protection ----------------
     Every public form below renders a Cloudflare Turnstile widget and reads
     its response token from the hidden input Turnstile injects into the
     widget's container. The token is verified against our own deployed
     Worker (never against Cloudflare's siteverify directly from the
     browser) before the existing submit logic runs. */
  const TURNSTILE_WORKER_URL = "https://turnstile-siteverify-sfr-rescue.shiann.workers.dev";

  function getTurnstileToken(container) {
    const input = container && container.querySelector('[name="cf-turnstile-response"]');
    return input ? input.value : "";
  }

  async function verifyTurnstile(token) {
    if (!token) return false;
    try {
      const r = await fetch(TURNSTILE_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await r.json().catch(() => ({}));
      return !!data.success;
    } catch (e) {
      return false;
    }
  }

  const SF = {
    // public
    getStats:        () => apiGet("/stats"),
    getAnimals:      (q = "") => apiGet("/animals" + q),
    getFeatured:     () => apiGet("/animals/featured"),
    getAnimal:       (id) => apiGet("/animals/" + id),
    getAuction:      (q = "") => apiGet("/fundraiser/items" + q),
    placeBid:        (itemId, payload) => apiSend("POST", "/fundraiser/items/" + itemId + "/bids", payload),
    getStories:      () => apiGet("/stories"),
    getStory:        (id) => apiGet("/stories/" + id),
    getResidents:    () => apiGet("/animals?status=resident"),
    sendContact:     (payload) => apiSend("POST", "/contact", payload),
    subscribe:       (email, source) => apiSend("POST", "/newsletter", { email, source }),
    verifyTurnstile: verifyTurnstile,
    getTurnstileToken: getTurnstileToken,
    // NOTE: no admin client here by design. All admin operations (animals,
    // auction items, contact inbox) are performed through the SanctuaryBase
    // app, which proxies to this site's /api/admin/* routes server-side.
  };

  /* ---------------- formatting helpers ---------------- */
  SF.esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  SF.money = (cents) => {
    if (cents == null || isNaN(cents)) return "—";
    return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  SF.statusLabel = (s) => ({ available: "Available", fostered: "In Foster", adopted: "Adopted", resident: "Sanctuary Resident" }[s] || s);
  SF.statusClass = (s) => ({ available: "tag-available", fostered: "tag-fostered", adopted: "tag-adopted", resident: "tag-resident" }[s] || "tag-available");

  SF.metaBits = (a) => {
    const bits = [];
    if (a.breed) bits.push(a.breed);
    if (a.age) bits.push(a.age);
    if (a.sex) bits.push(a.sex);
    return bits;
  };

  window.SF = SF;

  /* ---------------- toast + screen-reader live region ---------------- */
  (function () {
    let liveRegion, toastEl, toastTimer;
    function ensure() {
      if (!liveRegion) {
        liveRegion = document.createElement("div");
        liveRegion.className = "sr-only";
        liveRegion.setAttribute("aria-live", "polite");
        liveRegion.setAttribute("aria-atomic", "true");
        document.body.appendChild(liveRegion);
      }
      if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.className = "sf-toast";
        toastEl.setAttribute("role", "status");
        document.body.appendChild(toastEl);
      }
    }
    SF.toast = function (msg, opts) {
      opts = opts || {};
      ensure();
      liveRegion.textContent = "";
      setTimeout(function () { liveRegion.textContent = msg; }, 60);
      var check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
      toastEl.innerHTML = (opts.icon === false ? "" : check) + "<span></span>";
      toastEl.querySelector("span").textContent = msg;
      requestAnimationFrame(function () { toastEl.classList.add("show"); });
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, opts.duration || 3600);
    };
    SF.announce = function (msg) { ensure(); liveRegion.textContent = ""; setTimeout(function () { liveRegion.textContent = msg; }, 60); };
  })();

  /* ---------------- analytics ---------------- */
  SF.track = function (name, props) {
    try {
      if (typeof window.plausible === "function") window.plausible(name, props ? { props: props } : undefined);
      else if (typeof window.gtag === "function") window.gtag("event", name, props || {});
    } catch (e) { /* analytics must never break the page */ }
  };
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/donate|gofundme|zeffy|paypal\.me|donorbox|givebutter/i.test(href)) {
      SF.track("Donate Click", { location: document.body.getAttribute("data-page") || "page", target: href.slice(0, 80) });
      try { sessionStorage.setItem("sf-donate-intent", "1"); } catch (e) {}
    }
  }, true);

  /* ---------------- keyboard activation for animal cards ---------------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var card = e.target.closest && e.target.closest("[data-animal][tabindex]");
    if (!card || e.target !== card) return;
    e.preventDefault();
    card.click();
  });

  /* ---------------- animal card renderer (shared by home + animals) ---------------- */
  window.animalCard = function (a, i) {
    var tags = '<span class="tag ' + SF.statusClass(a.status) + '">' + SF.esc(SF.statusLabel(a.status)) + '</span>';
    if (a.needsFoster) tags += '<span class="tag tag-foster">Needs foster</span>';
    if (a.isFeatured) tags += '<span class="tag tag-featured">Featured</span>';
    var meta = SF.metaBits(a).map(function (m) { return '<span>' + SF.esc(m) + '</span>'; }).join("");
    var img = a.imageUrl || (a.imageUrls && a.imageUrls[0]) || "images/logo-mark.webp";
    return '' +
      '<article class="card reveal" data-d="' + ((i || 0) % 4) + '" data-animal="' + a.id + '" tabindex="0" style="cursor:pointer">' +
        '<div class="card-media"><div class="media-tags">' + tags + '</div>' +
          '<img src="' + SF.esc(img) + '" alt="' + SF.esc(a.name) + '" loading="lazy"></div>' +
        '<div class="card-body">' +
          '<h3>' + SF.esc(a.name) + '</h3>' +
          (meta ? '<div class="meta-row">' + meta + '</div>' : '') +
          '<p class="muted" style="font-size:.95rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + SF.esc(a.description) + '</p>' +
          '<div class="card-foot"><span class="tag" style="font-size:.68rem;background:var(--bone-2);color:var(--muted);border:1px solid var(--line)">' + SF.esc(a.species) + '</span><span class="btn btn-clay btn-sm" style="font-size:.82rem">Meet ' + SF.esc(a.name) + '</span></div>' +
        '</div>' +
      '</article>';
  };

  /* ---------------- nav: scroll state, mobile menu, dropdown, active link ---------------- */
  function initNav() {
    const header = document.querySelector("header.nav");
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (toggle && links) {
      const syncNavOpen = () => {
        const open = links.classList.contains("open");
        document.body.classList.toggle("nav-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      };
      toggle.addEventListener("click", () => { links.classList.toggle("open"); syncNavOpen(); });
      links.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", () => {
          if (window.innerWidth <= 940) { links.classList.remove("open"); syncNavOpen(); }
        });
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && links.classList.contains("open")) { links.classList.remove("open"); syncNavOpen(); } });
      window.addEventListener("resize", () => { if (window.innerWidth > 940 && links.classList.contains("open")) { links.classList.remove("open"); syncNavOpen(); } });
    }

    const dropdownToggles = document.querySelectorAll(".nav-dropdown-toggle");
    let closeTimeout;

    dropdownToggles.forEach((toggle) => {
      const wrapper = toggle.closest(".nav-dropdown-wrapper");
      const menu = wrapper?.querySelector(".nav-dropdown-menu");
      if (!menu) return;

      toggle.setAttribute("aria-haspopup", "true");
      toggle.setAttribute("aria-expanded", "false");
      if (window.MutationObserver) {
        new MutationObserver(() => {
          toggle.setAttribute("aria-expanded", menu.classList.contains("open") ? "true" : "false");
        }).observe(menu, { attributes: true, attributeFilter: ["class"] });
      }

      toggle.addEventListener("click", (e) => {
        const links = document.querySelector(".nav-links");
        const isMobile = !links || window.getComputedStyle(links).position === "absolute";

        if (isMobile) {
          e.preventDefault();
          e.stopPropagation();
          clearTimeout(closeTimeout);
          document.querySelectorAll(".nav-dropdown-menu").forEach((m) => {
            if (m !== menu) m.classList.remove("open");
          });
          menu.classList.toggle("open");
        }
      });

      wrapper.addEventListener("mouseenter", () => {
        clearTimeout(closeTimeout);
      });

      wrapper.addEventListener("mouseleave", () => {
        clearTimeout(closeTimeout);
        closeTimeout = setTimeout(() => {
          menu.classList.remove("open");
        }, 150);
      });

      menu.querySelectorAll("a").forEach((item) => {
        item.addEventListener("click", () => {
          menu.classList.remove("open");
          const links = document.querySelector(".nav-links");
          if (links) links.classList.remove("open");
        });
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".nav-dropdown-wrapper")) {
        clearTimeout(closeTimeout);
        closeTimeout = setTimeout(() => {
          document.querySelectorAll(".nav-dropdown-menu").forEach((m) => m.classList.remove("open"));
        }, 50);
      }
    });

    if (header) {
      const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 12);
      onScroll();
      window.addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });
    }
    const page = document.body.getAttribute("data-page");
    document.querySelectorAll(".nav-links a[data-nav]").forEach((a) => {
      if (a.getAttribute("data-nav") === page) a.classList.add("active");
    });
  }

  /* ---------------- scroll progress bar ---------------- */
  function initScrollbar() {
    const bar = document.querySelector(".scrollbar");
    if (!bar) return;
    const upd = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    };
    upd();
    window.addEventListener("scroll", () => requestAnimationFrame(upd), { passive: true });
  }

  /* ---------------- reveal-on-scroll animations ---------------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !els.length) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach((e) => io.observe(e));
  }
  SF.observe = function (root) {
    (root || document).querySelectorAll(".reveal:not(.in)").forEach((e) => {
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: 0.1 });
        io.observe(e);
      } else e.classList.add("in");
    });
  };

  /* ---------------- animated number count-up ---------------- */
  SF.countUp = function (el, target, suffix) {
    target = Number(target) || 0;
    suffix = suffix || "";
    const dur = 1300, start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* ---------------- footer copyright year ---------------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
  }

  /* ---------------- "years of rescue" — founded 2012, never hardcode this ---------------- */
  var FOUNDED_YEAR = 2012;
  function initYearsActive() {
    var years = new Date().getFullYear() - FOUNDED_YEAR;
    document.querySelectorAll("[data-years-active]").forEach((e) => (e.textContent = years));
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initScrollbar();
    initReveal();
    initYear();
    initYearsActive();
  });
})();

/* ---------------- announce bar: hide after scroll threshold ---------------- */
(function () {
  var bar = document.getElementById("announce-bar");
  if (!bar) return;
  var hidden = false;
  window.addEventListener("scroll", function () {
    if (window.scrollY > 80 && !hidden) {
      bar.classList.add("hidden");
      hidden = true;
    } else if (window.scrollY <= 20 && hidden) {
      bar.classList.remove("hidden");
      hidden = false;
    }
  }, { passive: true });
})();

/* ---------------- animals page: search + result count badge ---------------- */
(function () {
  if (!document.body || document.body.getAttribute("data-page") !== "animals") return;

  var filtersEl = document.querySelector(".filters");
  if (!filtersEl) return;

  var searchWrap = document.createElement("div");
  searchWrap.className = "animal-search-wrap";
  searchWrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg><input class="animal-search" type="search" placeholder="Search by name or species" aria-label="Search animals" id="animal-search-input">';

  var countBadge = document.createElement("span");
  countBadge.className = "animal-count-badge";
  countBadge.id = "animal-count-badge";

  filtersEl.appendChild(searchWrap);
  filtersEl.appendChild(countBadge);

  var searchInput = document.getElementById("animal-search-input");
  var searchTimer;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(filterAnimals, 160);
  });

  function filterAnimals() {
    var q = (searchInput.value || "").toLowerCase().trim();
    var cards = document.querySelectorAll("#animals-grid [data-animal]");
    var visible = 0;
    cards.forEach(function (c) {
      var text = c.textContent.toLowerCase();
      var show = !q || text.includes(q);
      c.style.display = show ? "" : "none";
      if (show) visible++;
    });
    updateCount(visible, cards.length);
  }

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      setTimeout(function () {
        var cards = document.querySelectorAll("#animals-grid [data-animal]");
        var visible = Array.from(cards).filter(function(c){ return c.style.display !== "none"; }).length;
        updateCount(visible, cards.length);
      }, 50);
    });
  });

  function updateCount(visible, total) {
    var badge = document.getElementById("animal-count-badge");
    if (!badge) return;
    if (total > 0) badge.textContent = visible + " of " + total + " animals";
  }

  var grid = document.getElementById("animals-grid");
  if (grid && window.MutationObserver) {
    var mo = new MutationObserver(function () {
      var cards = grid.querySelectorAll("[data-animal]");
      if (cards.length) updateCount(cards.length, cards.length);
    });
    mo.observe(grid, { childList: true, subtree: true });
  }
})();

/* ---------------- animal cards: share button (Web Share API / clipboard fallback) ---------------- */
(function () {
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".card-share-btn");
    if (!btn) return;
    var card = btn.closest("[data-animal]");
    if (!card) return;
    var name = card.querySelector("h3") ? card.querySelector("h3").textContent : "this animal";
    var url = window.location.origin + "/animals.html#animal-" + card.getAttribute("data-animal");
    var text = "Meet " + name + " at Saint Francis Rescue & Sanctuary in Yuma, AZ!";
    if (navigator.share) {
      navigator.share({ title: name, text: text, url: url }).catch(function () {});
    } else {
      navigator.clipboard.writeText(url).then(function () {
        btn.title = "Link copied!";
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';
        setTimeout(function () {
          btn.title = "Share";
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
        }, 2000);
      }).catch(function () {});
    }
  });

  function injectShareButtons() {
    document.querySelectorAll("[data-animal]:not([data-share-injected])").forEach(function (card) {
      var foot = card.querySelector(".card-foot");
      if (!foot) return;
      var btn = document.createElement("button");
      btn.className = "card-share-btn";
      btn.title = "Share";
      btn.setAttribute("aria-label", "Share this animal");
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
      foot.insertBefore(btn, foot.firstChild);
      card.setAttribute("data-share-injected", "1");
    });
  }

  var grids = document.querySelectorAll("#animals-grid, #featured-grid, #residents-grid");
  if (window.MutationObserver) {
    grids.forEach(function (grid) {
      if (!grid) return;
      new MutationObserver(injectShareButtons).observe(grid, { childList: true, subtree: true });
    });
  }
})();

/* ---------------- volunteer page: time-commitment selector ---------------- */
(function () {
  if (!document.body || document.body.getAttribute("data-page") !== "volunteer") return;
  var ctaSection = document.querySelector(".section.tone-pine");
  if (!ctaSection) return;

  var wrap = ctaSection.querySelector(".wrap");
  if (!wrap) return;

  var selectorHTML = '<div style="margin-top:2rem;text-align:left"><p class="reveal" data-d="3" style="font-size:.92rem;font-weight:700;color:rgba(251,248,241,.9);margin-bottom:.7rem;letter-spacing:.04em;text-transform:uppercase;font-size:.78rem">How much time can you give?</p><div class="time-selector" id="time-selector"><div class="time-option" data-hours="1" data-d="3"><span class="to-icon">🌱</span><span class="to-hours">1&ndash;2 hrs/mo</span><span class="to-label">Light touch</span></div><div class="time-option" data-hours="4"><span class="to-icon">🌿</span><span class="to-hours">4&ndash;8 hrs/mo</span><span class="to-label">Regular help</span></div><div class="time-option" data-hours="12"><span class="to-icon">🌳</span><span class="to-hours">12+ hrs/mo</span><span class="to-label">Core volunteer</span></div><div class="time-option" data-hours="special"><span class="to-icon">🎨</span><span class="to-hours">Skills only</span><span class="to-label">Design, vet, etc.</span></div></div><div id="volunteer-match"></div></div>';

  wrap.insertAdjacentHTML("beforeend", selectorHTML);

  var matches = {
    "1": { title: "Event & transport support fits perfectly.", desc: "Flexible shifts that work around your schedule - adoption events, vet runs, one-off tasks. No recurring commitment required." },
    "4": { title: "Regular weekend shifts are a great fit.", desc: "Join our weekend feeding crew or help coordinate fosters. Even a half-day every other week makes a real difference." },
    "12": { title: "You could become one of our core volunteers.", desc: "Daily animal care, intake coordination, and mentoring new volunteers. This is where the deepest bonds with the animals happen." },
    "special": { title: "We'd love your expertise.", desc: "Photographers, vets, designers, social media helpers, and grant writers - your skills directly support the mission without physical on-site time." }
  };

  document.querySelectorAll(".time-option").forEach(function (opt) {
    opt.addEventListener("click", function () {
      document.querySelectorAll(".time-option").forEach(function(o){ o.classList.remove("selected"); });
      opt.classList.add("selected");
      var h = opt.getAttribute("data-hours");
      var m = matches[h];
      var box = document.getElementById("volunteer-match");
      if (m && box) {
        box.innerHTML = '<h4>' + m.title + '</h4><p>' + m.desc + '</p>' +
          '<a class="btn btn-gold btn-sm" href="volunteer-signup.html" style="margin-top:.9rem">Start volunteering &rarr;</a>';
        box.classList.add("show");
      }
    });
  });
})();

/* ---------------- animals page: paw-animated loading skeleton ---------------- */
(function () {
  var grid = document.getElementById("animals-grid");
  if (!grid) return;
  var skels = grid.querySelectorAll(".card .skeleton");
  if (skels.length && grid.querySelectorAll("[data-animal]").length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem;color:var(--muted)"><span class="loading-paw">🐾</span><p style="font-size:.95rem">Loading animals&hellip;</p></div>';
  }
})();

(function () {
  "use strict";

  /* ---------------- count-up: respect prefers-reduced-motion ---------------- */
  var origCountUp = SF.countUp;
  SF.countUp = function (el, target, suffix) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = Number(target).toLocaleString() + (suffix || "");
      return;
    }
    origCountUp.call(SF, el, target, suffix);
  };

  /* ---------------- contact form: inline validation ---------------- */
  function initInlineValidation() {
    var form = document.getElementById("contact-form");
    if (!form) return;

    function getField(el) { return el.closest(".field"); }

    function validateField(el) {
      var fieldEl = getField(el);
      if (!fieldEl) return true;
      var errEl = fieldEl.querySelector(".field-error");
      var val = el.value.trim();
      var ok = true;
      var msg = "";

      if (el.required && !val) {
        ok = false;
        msg = el.tagName === "SELECT" ? "Please choose an option." : "This field is required.";
      } else if (el.type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        ok = false;
        msg = "Please enter a valid email address.";
      }

      fieldEl.classList.toggle("valid", ok && !!val);
      fieldEl.classList.toggle("invalid", !ok);
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.toggle("show", !ok);
      }
      return ok;
    }

    form.querySelectorAll(".field").forEach(function (fieldEl) {
      var input = fieldEl.querySelector("input, select, textarea");
      if (!input) return;
      if (!fieldEl.querySelector(".field-error")) {
        var err = document.createElement("span");
        err.className = "field-error";
        err.setAttribute("role", "alert");
        err.setAttribute("aria-live", "polite");
        fieldEl.appendChild(err);
      }
      input.addEventListener("blur", function () { validateField(input); });
      input.addEventListener("input", function () {
        if (fieldEl.classList.contains("invalid")) validateField(input);
      });
    });

    form.addEventListener("submit", function (e) {
      // honeypot: real users never fill the hidden "company" field
      var hp = form.querySelector('[name="company"]');
      if (hp && hp.value) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      form.querySelectorAll("input, select, textarea").forEach(function (el) {
        if (el.required) validateField(el);
      });
    }, true); // capture phase so it runs before the existing submit handler
  }

  /* ---------------- animal modal: keyboard trap + focus management ---------------- */
  function initModalFocusTrap() {
    var overlay = document.getElementById("animal-modal");
    if (!overlay) return;

    var lastFocus = null;

    var origOpen = window.openModal;
    if (typeof origOpen === "function") {
      window.openModal = function () {
        lastFocus = document.activeElement;
        origOpen.apply(this, arguments);
        requestAnimationFrame(function () {
          var focusable = overlay.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length) focusable[0].focus();
        });
      };
    }

    var origClose = window.closeModal;
    if (typeof origClose === "function") {
      window.closeModal = function () {
        origClose.apply(this, arguments);
        if (lastFocus) lastFocus.focus();
        lastFocus = null;
      };
    }

    overlay.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusable = Array.from(overlay.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------------- mobile nav: backdrop tap to close ---------------- */
  function initNavBackdrop() {
    var navLinks = document.querySelector(".nav-links");
    var toggle = document.querySelector(".nav-toggle");
    if (!navLinks || !toggle) return;

    var backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);

    function close() {
      navLinks.classList.remove("open");
      backdrop.classList.remove("show");
      toggle.setAttribute("aria-expanded", "false");
    }
    function open() {
      backdrop.classList.add("show");
      toggle.setAttribute("aria-expanded", "true");
    }

    backdrop.addEventListener("click", close);

    if (window.MutationObserver) {
      new MutationObserver(function () {
        if (navLinks.classList.contains("open")) open();
        else backdrop.classList.remove("show");
      }).observe(navLinks, { attributes: true, attributeFilter: ["class"] });
    }

    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "nav-links-menu");
    navLinks.id = "nav-links-menu";
  }

  /* ---------------- broken image fallback ---------------- */
  function initImageFallbacks() {
    document.querySelectorAll("img:not([src*='logo']):not([src*='hero']):not([src*='about']):not([src*='saint-francis'])").forEach(function (img) {
      if (img.getAttribute('loading') !== 'lazy' && img.complete && img.naturalWidth === 0) applyFallback(img);
      img.addEventListener("error", function () { applyFallback(img); });
    });

    if (window.MutationObserver) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (n) {
            if (n.nodeType !== 1) return;
            var imgs = n.tagName === "IMG" ? [n] : Array.from(n.querySelectorAll("img"));
            imgs.forEach(function (img) {
              img.addEventListener("error", function () { applyFallback(img); });
            });
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  function applyFallback(img) {
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "1";
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23ece4d6'/%3E%3Cg fill='%23c4b89a' opacity='.6'%3E%3Ccircle cx='170' cy='120' r='22'/%3E%3Ccircle cx='230' cy='120' r='22'/%3E%3Ccircle cx='140' cy='155' r='18'/%3E%3Ccircle cx='260' cy='155' r='18'/%3E%3Cpath d='M200 145 c-38 0-66 24-66 52 c0 19 14 33 29 33 c7 0 13-3 19-8 c5-4 11-6 18-6 s13 2 18 6 c6 5 12 8 19 8 c15 0 29-14 29-33 c0-28-28-52-66-52z'/%3E%3C/g%3E%3C/svg%3E";
    img.classList.add("img-error");
    img.alt = img.alt || "Animal photo unavailable";
  }

  /* ---------------- donate page: pre-select default amount ---------------- */
  function initDonateAmountDefault() {
    var btns = document.querySelectorAll(".donation-amount-btn");
    if (!btns.length) return;
    var defaultBtn = document.querySelector(".donation-amount-btn.popular-pick") ||
                     btns[1] || btns[0];
    if (defaultBtn && !document.querySelector(".donation-amount-btn.selected")) {
      defaultBtn.classList.add("selected");
    }
  }

  /* ---------------- sticky donate bar: sync body state ---------------- */
  function initStickyBarBodyClass() {
    var bar = document.getElementById("sticky-donate-bar");
    if (!bar) return;

    function sync() {
      document.body.classList.toggle("sdb-visible", bar.classList.contains("visible"));
    }
    sync();
    if (window.MutationObserver) {
      new MutationObserver(sync).observe(bar, { attributes: true, attributeFilter: ["class"] });
    }
  }

  /* ---------------- back-to-top button ---------------- */
  function initBackToTop() {
    if (!document.querySelector(".back-top")) {
      var btn = document.createElement("a");
      btn.className = "back-top";
      btn.href = "#top";
      btn.setAttribute("aria-label", "Back to top");
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" style="width:22px;height:22px" aria-hidden="true"><ellipse cx="7.2" cy="9.5" rx="1.7" ry="2.3"/><ellipse cx="12" cy="7.6" rx="1.8" ry="2.5"/><ellipse cx="16.8" cy="9.5" rx="1.7" ry="2.3"/><ellipse cx="4.6" cy="14" rx="1.5" ry="2"/><ellipse cx="19.4" cy="14" rx="1.5" ry="2"/><path d="M12 12.4c-2.6 0-4.8 1.9-5.3 4.1-.3 1.4.8 2.6 2.2 2.6.9 0 1.7-.4 3.1-.4s2.2.4 3.1.4c1.4 0 2.5-1.2 2.2-2.6-.5-2.2-2.7-4.1-5.3-4.1Z"/></svg>';
      document.body.appendChild(btn);
      if (!document.getElementById("top")) {
        var anchor = document.createElement("a");
        anchor.id = "top";
        document.body.insertBefore(anchor, document.body.firstChild);
      }
    }

    var backBtn = document.querySelector(".back-top");
    backBtn.style.display = "";

    function updateVisibility() {
      backBtn.classList.toggle("visible", window.scrollY > 600);
    }
    updateVisibility();
    window.addEventListener("scroll", function () { requestAnimationFrame(updateVisibility); }, { passive: true });
  }

  /* ---------------- contact page: prefill from URL params ---------------- */
  function initContactPrefill() {
    if (document.body.getAttribute("data-page") !== "contact") return;
    function prefill() {
      var params = new URLSearchParams(location.search);
      var subj = params.get("subject");
      var about = params.get("about");
      var sel = document.getElementById("cf-subject");
      var msg = document.getElementById("cf-message");
      if (sel && subj) {
        var matched = Array.from(sel.options).some(function (o) { return o.value === subj; });
        if (matched) { sel.value = subj; sel.closest(".field") && sel.closest(".field").classList.add("valid"); }
      }
      if (msg && about) {
        msg.value = "Regarding: " + about + "\n\n";
        msg.focus();
        msg.setSelectionRange(msg.value.length, msg.value.length);
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", prefill);
    } else {
      prefill();
    }
  }

  /* ---------------- newsletter signup form ---------------- */
  function initNewsletter() {
    document.querySelectorAll(".pfs-form").forEach(function (form) {
      if (form.dataset.wired) return;
      form.dataset.wired = "1";
      var btn = form.querySelector("button");
      var input = form.querySelector('input[type="email"]');
      if (!btn || !input) return;

      var err = document.createElement("p");
      err.className = "pfs-error";
      err.setAttribute("role", "alert");
      form.insertAdjacentElement("afterend", err);

      function fail(msg) {
        err.textContent = msg;
        err.classList.add("show");
        input.setAttribute("aria-invalid", "true");
        input.focus();
      }
      function submit() {
        var val = input.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { fail("Please enter a valid email address."); return; }
        err.textContent = "";
        err.classList.remove("show");
        input.removeAttribute("aria-invalid");
        btn.disabled = true;
        btn.textContent = "Signing up...";
        var page = document.body.getAttribute("data-page") || location.pathname;
        SF.verifyTurnstile(SF.getTurnstileToken(form)).then(function (verified) {
          if (!verified) {
            btn.disabled = false;
            btn.textContent = "Keep me posted";
            fail("Please complete the verification and try again.");
            return;
          }
          SF.subscribe(val, page)
            .then(function () {
              form.innerHTML = '<span style="color:var(--clay-text);font-weight:600;font-size:.95rem">✓ Thanks! You\'re on the list.</span>';
              SF.announce("Thanks - you are subscribed. We will be in touch.");
              SF.track("Newsletter Signup", { location: page });
            })
            .catch(function () {
              btn.disabled = false;
              btn.textContent = "Keep me posted";
              fail("Something went wrong - please try again in a moment.");
            });
        });
      }
      btn.addEventListener("click", submit);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    });
  }

  /* ---------------- name-a-rescue suggestion widget ---------------- */
  function initNameSuggest() {
    var inner = document.querySelector(".pre-footer-strip .pfs-inner");
    if (!inner || document.getElementById("pfs-name-form")) return;

    var EMOJIS = ["🐴", "🐐", "🐔", "🐑", "🐖", "🐮", "🦙", "🦝", "🦌"];

    var block = document.createElement("div");
    block.className = "pfs-name-block";
    block.innerHTML =
      '<div class="pfs-text"><strong class="pfs-name-title">Help name our next rescue 🐾</strong></div>' +
      '<div class="pfs-form" id="pfs-name-form">' +
        '<input type="text" id="pfs-name-input" maxlength="40" placeholder="e.g. Willow" aria-label="Suggest a name for our next rescue">' +
        '<button class="btn btn-clay btn-sm" type="button" id="pfs-name-submit">Suggest</button>' +
      '</div>' +
      '<p class="pfs-note"><a href="names.html">See all suggestions &amp; vote &rarr;</a></p>';
    inner.appendChild(block);

    var form = block.querySelector("#pfs-name-form");
    var input = block.querySelector("#pfs-name-input");
    var btn = block.querySelector("#pfs-name-submit");

    var err = document.createElement("p");
    err.className = "pfs-error";
    err.setAttribute("role", "alert");
    form.insertAdjacentElement("afterend", err);

    function submit() {
      var val = input.value.trim();
      if (val.length < 2) {
        err.textContent = "Please enter a name (at least 2 letters).";
        err.classList.add("show");
        input.focus();
        return;
      }
      err.textContent = "";
      err.classList.remove("show");
      btn.disabled = true;
      btn.textContent = "Submitting...";

      var emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: val, emoji: emoji })
      }).then(function(res) { return res.json(); }).then(function(data) {
        if (data.id) {
          if (typeof window.addNameSuggestion === "function") {
            window.addNameSuggestion(val, "Anonymous");
          }
          form.innerHTML = "";
          var ok = document.createElement("span");
          ok.style.cssText = "color:var(--clay-text);font-weight:600;font-size:.95rem";
          ok.appendChild(document.createTextNode('"' + val + '" added - '));
          var link = document.createElement("a");
          link.href = "names.html";
          link.textContent = "vote on it →";
          ok.appendChild(link);
          form.appendChild(ok);
          if (window.SF) {
            window.SF.announce("Thanks - your name suggestion was added.");
            window.SF.track("Name Suggested", { location: document.body.getAttribute("data-page") || location.pathname });
          }
        }
      }).catch(function() {
        btn.disabled = false;
        btn.textContent = "Suggest";
        err.textContent = "Something went wrong - please try again.";
        err.classList.add("show");
      });
    }

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });
  }

  function runUX() {
    initInlineValidation();
    initModalFocusTrap();
    initNavBackdrop();
    initImageFallbacks();
    initDonateAmountDefault();
    initStickyBarBodyClass();
    initBackToTop();
    initContactPrefill();
    initNewsletter();
    initNameSuggest();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runUX);
  } else {
    runUX();
  }

})();

/* ============================================================
   v36 — live countdowns + horizontal carousel controls
   ============================================================ */
(function () {
  "use strict";
  var SF = window.SF;

  /* Time remaining until an ISO date.
     Returns { text, urgent (<24h), ended } */
  SF.timeLeft = function (iso) {
    var end = new Date(iso).getTime();
    if (isNaN(end)) return null;
    var ms = end - Date.now();
    if (ms <= 0) return { text: "Ended", urgent: false, ended: true };
    var m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    var text;
    if (d >= 2) text = d + " days left";
    else if (h >= 1) text = (d >= 1 ? d + "d " + (h % 24) + "h" : h + "h " + (m % 60) + "m") + " left";
    else text = m + " min left";
    return { text: text, urgent: ms < 864e5, ended: false };
  };

  /* Tick every element with [data-countdown="<iso>"]. Re-renders each minute. */
  SF.startCountdowns = function (root) {
    var els = (root || document).querySelectorAll("[data-countdown]");
    if (!els.length) return;
    function tick() {
      els.forEach(function (el) {
        var t = SF.timeLeft(el.getAttribute("data-countdown"));
        if (!t) { el.style.display = "none"; return; }
        var span = el.querySelector("span") || el;
        span.textContent = t.text;
        el.classList.toggle("urgent", t.urgent && !t.ended);
        el.classList.toggle("ended", t.ended);
      });
    }
    tick();
    setInterval(tick, 30000);
  };

  /* Horizontal scroll-snap carousel with prev/next buttons.
     Container: .tails-carousel > .tails-scroller + button.tails-nav.prev/.next */
  SF.initCarousel = function (container) {
    var scroller = container.querySelector(".tails-scroller");
    var prev = container.querySelector(".tails-nav.prev");
    var next = container.querySelector(".tails-nav.next");
    if (!scroller || !prev || !next) return;
    function step() {
      var card = scroller.firstElementChild;
      return card ? card.getBoundingClientRect().width + 22 : 320;
    }
    function update() {
      var max = scroller.scrollWidth - scroller.clientWidth - 4;
      prev.disabled = scroller.scrollLeft <= 4;
      next.disabled = scroller.scrollLeft >= max;
    }
    prev.addEventListener("click", function () { scroller.scrollBy({ left: -step(), behavior: "smooth" }); });
    next.addEventListener("click", function () { scroller.scrollBy({ left: step(), behavior: "smooth" }); });
    scroller.addEventListener("scroll", function () { requestAnimationFrame(update); }, { passive: true });
    window.addEventListener("resize", update);
    update();
  };
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".tails-carousel").forEach(SF.initCarousel);
    SF.startCountdowns(document);
  });
})();
