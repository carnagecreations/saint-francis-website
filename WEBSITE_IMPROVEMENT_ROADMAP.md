# Saint Francis Rescue Website — 90-Day Improvement Roadmap

**Goal:** Increase volunteer signups, donor retention, and foster/adoption applications through UX, accessibility, and funnel optimization.

---

## PHASE 1: Accessibility Quick Wins (Weeks 1–2)
**Est. 40 hours | Cost if outsourced: $2K–3K**

### 1.1 Run Automated Accessibility Audit

**What to do:**
1. Install **Axe DevTools** browser extension (free)
   - Chrome: https://chrome.google.com/webstore/detail/axe-devtools/lhdoppojpmngadmnkpklempisson
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/axe-devtools/
   
2. Visit each page and run Axe scan:
   - https://sfr-rescue.pages.dev/ (homepage)
   - https://sfr-rescue.pages.dev/donate
   - https://sfr-rescue.pages.dev/animals
   - https://sfr-rescue.pages.dev/volunteer
   - https://sfr-rescue.pages.dev/foster-apply
   - https://sfr-rescue.pages.dev/adopt-apply
   - https://sfr-rescue.pages.dev/contact
   - https://sfr-rescue.pages.dev/fundraiser
   - https://sfr-rescue.pages.dev/about
   - https://sfr-rescue.pages.dev/ways-to-help

3. Export report (Axe → "Save as PDF") and save to:
   `C:\Users\lawye\Projects\SaintFrancis-Website\docs\accessibility-audit-initial.pdf`

**Success criteria:** Report generated, baseline issues documented

---

### 1.2 Fix Critical Issues (WCAG AA Level)

**Issue #1: Impact Slider Not Keyboard Accessible**

**File:** `donate.html` (lines 391–447)

**Problem:** Users can't navigate or change the slider with keyboard (Tab, arrow keys).

**Fix:**
```html
<!-- FIND THIS (line 214): -->
<input id="donationRange" type="range" min="10" max="500" step="10" value="50" />

<!-- UPDATE TO: -->
<input 
  id="donationRange" 
  type="range" 
  min="10" 
  max="500" 
  step="10" 
  value="50"
  aria-label="Choose donation amount from $10 to $500"
  aria-valuetext="$50"
/>
```

**Also update the JavaScript** (after line 439, inside the `updateDonation()` function):
```javascript
function updateDonation() {
  const value = Number(slider.value);
  amount.textContent = '$' + value;
  impact.textContent = getImpact(value);
  donateBtn.textContent = 'Donate $' + value + ' now →';
  
  // ADD THIS LINE:
  slider.setAttribute('aria-valuetext', '$' + value);
  
  // ... rest of function
}
```

**Test:** Tab to slider, use Left/Right arrow keys to change value, verify announcement updates.

**Est. time:** 15 min

---

**Issue #2: Donation Amount Announcement Missing for Screen Readers**

**File:** `donate.html` (line 219)

**Problem:** Screen reader users don't hear when the donation amount changes.

**Fix:**
```html
<!-- FIND THIS (line 219): -->
<div class="impact-box" aria-live="polite">

<!-- CONFIRM IT HAS aria-live="polite" and add aria-atomic="true": -->
<div class="impact-box" aria-live="polite" aria-atomic="true">
```

**Test:** Turn on screen reader (macOS: Cmd+F5; Windows: Narrator via Win+Ctrl+Enter), adjust slider, verify it announces "$50", "$75", etc.

**Est. time:** 5 min

---

**Issue #3: Animal Modal Missing Focus Trap**

**File:** `app.js` (search for "animalModal" or "modal")

**Problem:** Keyboard users can Tab out of the animal detail modal into the background page.

**Instructions:**
1. Open `app.js` and find the animal modal code
2. Search for `addEventListener('keydown'` within the modal section
3. If no Tab trap exists, add this after the modal opens:

```javascript
const modal = document.querySelector('[role="dialog"]'); // or your modal selector
const focusableElements = modal.querySelectorAll(
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
);
const firstElement = focusableElements[0];
const lastElement = focusableElements[focusableElements.length - 1];

modal.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
  } else {
    if (document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
});
```

**Test:** Open animal modal, Tab through all buttons/links, verify Tab wraps to first element (doesn't escape to page behind).

**Est. time:** 20 min (if code already exists, verify it works; if not, implement)

---

**Issue #4: Form Label-to-Input Associations**

**Files:**
- `adopt-apply.html`
- `foster-apply.html`
- `volunteer-signup.html`
- `contact.html`

**Problem:** Form inputs missing `<label for="">` associations, so screen readers can't link labels to fields.

**Fix example (apply to all forms):**

```html
<!-- BEFORE: -->
<label>Your Name</label>
<input type="text" name="name">

<!-- AFTER: -->
<label for="name-field">Your Name</label>
<input type="text" name="name" id="name-field">
```

**Checklist for each form:**
- [ ] Every `<input>`, `<textarea>`, `<select>` has a unique `id`
- [ ] Every label has a matching `for="that-id"`
- [ ] Email inputs use `type="email"` (for mobile keyboard)
- [ ] Phone inputs use `type="tel"` (for mobile keyboard)

**Test:** Tab through form, screen reader should announce "Your Name, text input" (not just "text input").

**Est. time:** 30 min per form (4 forms = 2 hours total)

---

### 1.3 Color Contrast Fixes

**Tool:** WebAIM Contrast Checker (https://webaim.org/resources/contrastchecker/)

**Check these button combinations:**

| Element | File | Current Colors | Issue? | Fix |
|---------|------|-----------------|--------|-----|
| "See all ways to give" button | `donate.html` hero | Gold on cream | TBD | Increase saturation or darken gold |
| "Learn more" links | All pages | Gold on various | TBD | Verify 4.5:1 ratio (AA) |
| Secondary buttons | `app.js` vars | Check `--clay`, `--gold-soft` | TBD | Adjust CSS custom properties |

**Process:**
1. Go to WebAIM Contrast Checker
2. Paste hex color 1 (background, e.g., `#fbf8f1` cream)
3. Paste hex color 2 (foreground, e.g., `#d4b67a` gold)
4. If ratio < 4.5:1, it **fails AA**. Adjust color and retest.
5. Document changes needed in `styles.css`

**Quick fix in styles.css:**
```css
/* If gold button on cream fails contrast, try: */
.btn-gold {
  background: #b8900f; /* darker gold */
  color: #ffffff; /* white text instead of pine */
}
```

**Est. time:** 30 min

---

### 1.4 Image Alt Text Audit

**Files to check:**
- `animals.html` — all animal cards
- `stories.html` — story images
- `about.html` — team/facility photos
- `index.html` — hero image, impact images

**Process:**
1. Open DevTools (F12)
2. Search for all `<img>` tags
3. Check each `alt=""` attribute

**Current state examples (from reading the code):**
- ✅ Good: `<img alt="Charlie, a rescued tortoise" ...>` (descriptive)
- ❌ Bad: `<img alt="">` (missing)
- ❌ Bad: `<img alt="animal photo">` (too generic)

**Standards:**
- **Decorative images:** `alt=""` (screen readers skip)
- **Content images:** Describe the animal and context, e.g., "Luna, a three-year-old German Shepherd, resting on hay in the barn"
- **Action images:** Describe purpose, e.g., "Charlie's recovery from a feeding tube to full health"

**Template:**
```html
<!-- For animal profiles: -->
<img alt="[Name], a [breed] rescued from [situation], now thriving at the sanctuary" src="...">

<!-- For impact photos: -->
<img alt="[Story]: [what we see and why it matters]" src="...">

<!-- For decorative: -->
<img alt="" aria-hidden="true" src="..."> <!-- decorative only -->
```

**Audit checklist:**
- [ ] All animal images have descriptive alt text (20–40 words max)
- [ ] Stories page images describe the rescue, not just "person with animal"
- [ ] Hero images have alt (can be shorter: "Saint Francis sanctuary in Yuma, Arizona")
- [ ] Decorative graphics are marked with `aria-hidden="true"`

**Est. time:** 45 min

---

### 1.5 Deploy & Verify

**Test in real screen reader:**

1. **macOS (VoiceOver):**
   - Cmd+F5 to enable
   - VO = Control+Option
   - Navigate with VO+Right Arrow
   - Test donate slider, forms, modals

2. **Windows (NVDA - free):**
   - Download: https://www.nvaccess.org/download/
   - Install, start, navigate with arrow keys
   - Tab through forms

3. **Mobile (iOS):**
   - Settings → Accessibility → VoiceOver
   - Test volunteer signup form
   - Test donate button

**Commit to git:**
```bash
cd C:\Users\lawye\Projects\SaintFrancis-Website
git add .
git commit -m "Phase 1: Accessibility improvements

- Add keyboard support to donation slider (aria-label, aria-valuetext)
- Fix screen reader announcements for dynamic content (aria-live, aria-atomic)
- Add focus trap to animal modal (prevent Tab escape)
- Link form labels to inputs (for= associations)
- Fix color contrast on buttons (WCAG AA)
- Audit and improve image alt text

All changes verified with NVDA and VoiceOver."
```

**Deploy:**
```bash
npx wrangler pages deploy . --project-name=sfr-rescue --branch=main
```

**Success criteria:**
- [ ] Axe DevTools finds 0 critical/serious issues
- [ ] Keyboard users can navigate slider, forms, and modals
- [ ] VoiceOver/NVDA announce all dynamic changes
- [ ] WCAG AA contrast ratio passes on all buttons
- [ ] All images have descriptive alt text

**Phase 1 complete.** Move to Phase 2.

---

## PHASE 2: Email Capture & Donor Funnel (Weeks 2–3)
**Est. 30 hours | Cost if outsourced: $1.5K–2.5K**

### 2.1 Set Up Email Service

**Choose one (free tier sufficient for startup):**
- **Mailchimp** (best for nonprofits, has automation)
- **ConvertKit** (better deliverability)
- **Brevo** (free up to 300 contacts)

**Recommended: Mailchimp** (nonprofit discount available)

**Setup steps:**
1. Go to mailchimp.com
2. Sign up with admin@saintfrancisrescue.org (or check current email)
3. Create audience: "Saint Francis Newsletter"
4. Get API key: Account → Extras → API Keys
5. Save to `.dev.vars` for local testing:
   ```
   MAILCHIMP_API_KEY="your-api-key-here"
   MAILCHIMP_AUDIENCE_ID="your-audience-id-here"
   ```

**Do NOT commit `.dev.vars` to git** — it has secrets.

**Est. time:** 30 min

---

### 2.2 Add Email Capture Above the Fold

**File:** `index.html` (homepage)

**Current state:** Newsletter signup is in pre-footer strip (line 584–600). Move up.

**New location:** After hero section, before impact strip.

**Add this HTML** (after the donation hero buttons, around line 165):

```html
<section style="padding: 3rem 2rem; background: linear-gradient(135deg, var(--pine), var(--pine-700)); color: var(--cream); text-align: center;">
  <div class="wrap" style="max-width: 600px; margin: 0 auto;">
    <h2 style="font-size: 1.8rem; margin-bottom: 1rem; color: #fff;">Stay close to the animals</h2>
    <p style="font-size: 1rem; margin-bottom: 1.5rem; opacity: 0.95;">Get monthly rescue stories and ways to help — no spam, unsubscribe anytime.</p>
    
    <form id="email-capture-form" style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
      <input 
        type="email" 
        placeholder="your@email.com" 
        required 
        style="flex: 1; padding: 0.75rem 1rem; border: none; border-radius: 8px; font-size: 1rem;"
        aria-label="Email address"
      >
      <button 
        type="submit" 
        style="padding: 0.75rem 1.5rem; background: var(--gold); color: var(--pine); border: none; border-radius: 8px; font-weight: 700; cursor: pointer; white-space: nowrap;"
      >
        Keep me posted
      </button>
    </form>
    
    <p style="font-size: 0.85rem; opacity: 0.8;">✓ 501(c)(3) verified · ✓ No spam · ✓ Unsubscribe anytime</p>
  </div>
</section>
```

**Add JavaScript handler** (in `app.js`, after the DOMContentLoaded block):

```javascript
const emailForm = document.getElementById('email-capture-form');
if (emailForm) {
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailForm.querySelector('input[type="email"]').value;
    
    try {
      const response = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (response.ok) {
        SF.showToast('Thanks! Check your email to confirm.', 'success');
        emailForm.reset();
      } else {
        SF.showToast('Something went wrong. Try again.', 'error');
      }
    } catch (err) {
      console.error('Signup error:', err);
      SF.showToast('Connection error. Try again.', 'error');
    }
  });
}
```

**Est. time:** 45 min

---

### 2.3 Add Zeffy Webhook → Email Integration

**Current state:** Donations come in via Zeffy webhook, stored in Neon, no email sent.

**File:** `_worker.js` (Zeffy webhook handler, around line 14807)

**Add this after the donation is inserted (after line 14833):**

```javascript
// After the donation row is created, send welcome email via Mailchimp
const donorEmail = pickString(payment, ['donorEmail', 'email', 'payer_email']);
const donorName = pickString(payment, ['donorName', 'name', 'firstName']) || 'Friend';
const amountUSD = (payment.amountCents || 0) / 100;

if (donorEmail) {
  // Add to Mailchimp audience (fire-and-forget)
  await fetch('https://us1.api.mailchimp.com/3.0/lists/{AUDIENCE_ID}/members', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`apikey:${c.env.MAILCHIMP_API_KEY}`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email_address: donorEmail,
      status: 'subscribed',
      merge_fields: {
        FNAME: donorName,
        MMERGE3: `$${amountUSD.toFixed(2)}` // custom field: donation amount
      }
    })
  }).catch(err => console.error('Mailchimp sync failed:', err));
}
```

**You'll need to:**
1. Replace `{AUDIENCE_ID}` with your actual Mailchimp audience ID
2. Set `MAILCHIMP_API_KEY` as a Cloudflare Pages secret:
   ```bash
   echo "your-api-key" | npx wrangler pages secret put MAILCHIMP_API_KEY --project-name=sfr-rescue
   ```

**Est. time:** 45 min (if you set up Mailchimp first)

---

### 2.4 Create Email Sequences in Mailchimp

**Sequence 1: Donor Welcome (triggered on subscribe)**

| Email | Delay | Subject | Goal |
|-------|-------|---------|------|
| #1 | Immediate | "Welcome to Saint Francis Rescue" | Confirm subscription |
| #2 | 2 days | "Meet Charlie: How $50 Saved a Life" | Tell rescue story |
| #3 | 7 days | "Your Impact This Month" | Show donation impact |
| #4 | 14 days | "How to Double Your Gift" | Pitch monthly giving |

**Template (Mailchimp Builder):**
```
Subject: Welcome to Saint Francis Rescue

Hi *|FNAME|*,

Thanks for joining us. You're now part of a community that gives rescued animals a second chance.

Every month, we'll share:
- Real rescue stories
- How your donations help
- Ways to volunteer or foster

First, meet Charlie 👇
[Story link]

— Saint Francis Rescue
```

**Setup steps:**
1. Mailchimp → Automations → Create Automation
2. Trigger: "Signup"
3. Email sequence as table above
4. Save and activate

**Est. time:** 1 hour (Mailchimp UI navigation)

---

### 2.5 Track Email Performance

**In Mailchimp dashboard:**
- Monitor open rates (target: 25%+)
- Monitor click rates (target: 3%+)
- Watch unsubscribe rate (should be <0.5%)

**After 30 days, analyze:**
- Which subject lines got highest opens?
- Which story/content got clicks to donate again?
- Refine sequence based on performance

**Est. time:** 15 min setup, 10 min/week ongoing

---

### 2.6 Deploy & Test

**Update `.dev.vars` locally:**
```
MAILCHIMP_API_KEY="pk_live_xxxx"
MAILCHIMP_AUDIENCE_ID="abc123"
```

**Test locally:**
1. Go to http://localhost:5175/donate
2. Scroll up to new email capture form
3. Enter test email
4. Submit
5. Check Mailchimp audience → new subscriber should appear

**Deploy to production:**
```bash
cd C:\Users\lawye\Projects\SaintFrancis-Website
git add index.html app.js _worker.js
git commit -m "Phase 2: Email capture and donor funnel

- Add email signup form above fold on homepage
- Integrate Zeffy donations → Mailchimp subscriber sync
- Create automated welcome email sequence
- Track email metrics (open rate, clicks, unsubscribes)

All emails tested locally; Mailchimp configured with welcome sequence."
```

**Set Mailchimp API key in production:**
```bash
echo "pk_live_xxxx" | npx wrangler pages secret put MAILCHIMP_API_KEY --project-name=sfr-rescue
```

**Deploy:**
```bash
npx wrangler pages deploy . --project-name=sfr-rescue --branch=main
```

**Success criteria:**
- [ ] Email form appears above fold on homepage
- [ ] Donations trigger Mailchimp subscriber add
- [ ] Mailchimp welcome sequence sends on schedule
- [ ] Email open/click rates tracked
- [ ] Unsubscribe link works (compliance)

**Phase 2 complete.** Move to Phase 3.

---

## PHASE 3: Analytics & Data (Weeks 3–4)
**Est. 20 hours | Cost if outsourced: $1K–2K**

### 3.1 Set Up Google Analytics 4

**Current state:** GA4 tracking code commented out in HTML (see `index.html` line 25)

**Step 1: Create GA4 property**
1. Go to analytics.google.com
2. Sign in with admin@saintfrancisrescue.org account
3. Create Property → "Saint Francis Rescue Website"
4. Select "Web" as data stream
5. Enter URL: `https://sfr-rescue.pages.dev`
6. Copy the Measurement ID (format: `G-XXXXXXXX`)

**Step 2: Uncomment GA4 in index.html** (line 27–29)

```html
<!-- BEFORE (commented out): -->
<!-- <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-XXXXXXXXXX')</script> -->

<!-- AFTER (with your actual ID): -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments)}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXXXX'); // Replace with your ID
</script>
```

**Step 3: Add to all HTML pages**
Copy the script block above to:
- `donate.html` (after `</head>` or in `<head>`)
- `animals.html`
- `volunteer.html`
- `foster-apply.html`
- `adopt-apply.html`
- `contact.html`
- `fundraiser.html`
- `about.html`
- `ways-to-help.html`
- All other pages

**Or simplify:** Include it once in `app.js` (since all pages load it):

```javascript
// In app.js, at the top of DOMContentLoaded:
if (document.currentScript?.src.includes('app.js')) {
  // GA4 already loaded from HTML if present
  // This just verifies gtag is available
  if (typeof gtag === 'function') {
    gtag('event', 'page_view', { page_path: window.location.pathname });
  }
}
```

**Est. time:** 30 min

---

### 3.2 Add Event Tracking (in app.js)

**Event 1: Donation Click**
```javascript
// Existing code (line 442) already tracks this, but ensure it's there:
if (window.SF && SF.track) {
  SF.track('Donate Click', { 
    location: 'donate', 
    target: 'impact-slider', 
    amount: Number(slider.value), 
    monthly: !!monthlyToggle.checked 
  });
}

// Add GA4 tracking:
if (typeof gtag === 'function') {
  gtag('event', 'donate_click', {
    amount: Number(slider.value),
    monthly: !!monthlyToggle.checked,
    source: 'impact-slider'
  });
}
```

**Event 2: Volunteer Signup**
```javascript
// In volunteer-signup.html form submit handler:
if (typeof gtag === 'function') {
  gtag('event', 'volunteer_signup', {
    step: 'start'
  });
}

// On form success:
gtag('event', 'volunteer_signup', {
  step: 'complete',
  email: form.email.value
});
```

**Event 3: Foster/Adoption Application**
```javascript
// In adopt-apply.html and foster-apply.html:
const appType = document.body.getAttribute('data-page'); // 'adopt' or 'foster'

// On form start:
gtag('event', 'application_start', {
  type: appType // 'adopt' or 'foster'
});

// On form submit success:
gtag('event', 'application_complete', {
  type: appType
});
```

**Event 4: Newsletter Subscribe**
```javascript
// In email-capture-form submit (already in Phase 2):
gtag('event', 'newsletter_signup', {
  source: 'homepage'
});
```

**Event 5: Page Views (automatic in GA4, but verify)**
```javascript
// GA4 tracks page views by default. No code needed.
// But if using SPA-style navigation, manually call:
gtag('event', 'page_view', {
  page_path: '/animals',
  page_title: 'Our Animals'
});
```

**Est. time:** 1 hour

---

### 3.3 Create GA4 Dashboard

**In Google Analytics:**

1. Go to **Dashboards** (left sidebar)
2. Create new dashboard: "Saint Francis Website KPIs"
3. Add these widgets:

| Widget | Metric | Goal |
|--------|--------|------|
| Donation Clicks | Event count (donate_click) | 10+/month |
| Donation Rate | donate_click ÷ page_views (donate.html) | 2%+ |
| Volunteer Signups | Event count (volunteer_signup, step=complete) | 5+/month |
| Foster Applications | Event count (application_complete, type=foster) | 3+/month |
| Adoption Applications | Event count (application_complete, type=adopt) | 3+/month |
| Newsletter Signups | Event count (newsletter_signup) | 15+/month |
| Top Pages | Page path & view count | Identify traffic patterns |
| Device Breakdown | Mobile vs Desktop (page_views) | Responsive design check |

**Setup steps:**
1. Dashboard → Add widget
2. For each metric, choose:
   - **Metric type:** "Event count" or "Event count per user"
   - **Filter by:** Event name = "donate_click" (etc.)
   - **Dimension:** None (shows total) or "Date" (shows trend)
3. Set date range: Last 30 days
4. Save dashboard

**Est. time:** 45 min

---

### 3.4 Weekly Review Checklist

**Every Monday, spend 10 min reviewing:**
- [ ] How many donation clicks this week? (target: 2+)
- [ ] How many volunteer signups? (target: 1+)
- [ ] How many foster/adoption applications? (target: 1+)
- [ ] Newsletter subscriber growth? (target: +5)
- [ ] Top pages by traffic? (identify popular content)
- [ ] Device breakdown — mobile traffic %? (check if 40%+)
- [ ] Bounce rate on donate page? (should be <50%)

**If metric is low:**
- Donation clicks low? → Maybe hero button needs repositioning, or copy isn't compelling
- Volunteer signups low? → Maybe call-to-action buried, or form too long
- Newsletter low? → Maybe signup form not visible enough

**Screenshot the dashboard monthly** (save to `docs/analytics/`) to track progress.

**Est. time:** 10 min/week, 45 min setup

---

### 3.5 Deploy & Verify

**Test GA4 locally:**
1. Install **Google Analytics Debugger** extension
2. Go to http://localhost:5175/donate
3. Open DevTools (F12) → Application tab
4. Check for `gtag` calls in console
5. Open Analytics Debugger → should show events firing

**Commit:**
```bash
cd C:\Users\lawye\Projects\SaintFrancis-Website
git add *.html app.js
git commit -m "Phase 3: Analytics setup

- Add GA4 tracking to all pages (Measurement ID: G-XXXX)
- Track events: donate_click, volunteer_signup, application_complete, newsletter_signup
- Create GA4 dashboard with key metrics
- Set up weekly review checklist

All events verified in Analytics Debugger."
```

**Deploy:**
```bash
npx wrangler pages deploy . --project-name=sfr-rescue --branch=main
```

**Success criteria:**
- [ ] GA4 property created
- [ ] Events firing in real-time (check Analytics → Real-time)
- [ ] Dashboard shows metrics
- [ ] Weekly review checklist saved (in docs/ or Notion)

**Phase 3 complete.** Move to Phase 4.

---

## PHASE 4: UX Refinements (Weeks 4–8)
**Est. 60 hours | Cost if outsourced: $3K–5K**

### 4.1 Volunteer Funnel Inline Signup

**Current state:** "Volunteer" nav link goes to `/volunteer.html`, which has a signup form at the bottom.

**Problem:** User reads "Why volunteer?" section, gets interested, scrolls down for form (friction).

**Solution:** Add inline modal signup after "Why volunteer" benefits, before "Meet our volunteers" section.

**File:** `volunteer.html` (need to find structure; likely around line 150–200)

**Add this HTML** (after the "Why volunteer" section, before "Meet our volunteers"):

```html
<section style="padding: 4rem 2rem; background: linear-gradient(135deg, rgba(78,255,197,.1), rgba(78,255,197,.05)); border-radius: 16px; margin: 3rem 0; text-align: center;">
  <div class="wrap" style="max-width: 700px; margin: 0 auto;">
    <h2 style="font-size: 2rem; margin-bottom: 1rem; color: var(--pine);">Ready to get started?</h2>
    <p style="font-size: 1rem; color: var(--muted); margin-bottom: 2rem;">Join our team and start making a difference this week.</p>
    
    <button id="vol-signup-btn" style="padding: 1rem 2rem; background: var(--gold); color: var(--pine); border: none; border-radius: 8px; font-weight: 700; font-size: 1.1rem; cursor: pointer;">
      Volunteer Now →
    </button>
  </div>
</section>

<!-- Modal Signup Form -->
<div id="vol-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 9999; align-items: center; justify-content: center; padding: 1.5rem;">
  <div style="background: var(--cream); border-radius: 16px; max-width: 500px; width: 100%; padding: 2rem; box-shadow: 0 20px 60px rgba(0,0,0,.3);">
    <button id="vol-modal-close" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--muted);">×</button>
    
    <h2 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: var(--pine);">Volunteer with Us</h2>
    <p style="color: var(--muted); margin-bottom: 1.5rem;">Tell us about yourself and we'll be in touch within 2 days.</p>
    
    <form id="vol-signup-form" style="display: flex; flex-direction: column; gap: 1rem;">
      <input type="text" placeholder="Your name" required style="padding: 0.75rem; border: 1px solid var(--line); border-radius: 8px;">
      <input type="email" placeholder="your@email.com" required style="padding: 0.75rem; border: 1px solid var(--line); border-radius: 8px;">
      <input type="tel" placeholder="(520) 555-0123" style="padding: 0.75rem; border: 1px solid var(--line); border-radius: 8px;">
      
      <select style="padding: 0.75rem; border: 1px solid var(--line); border-radius: 8px;">
        <option value="">What interests you most?</option>
        <option value="animal-care">Animal Care</option>
        <option value="adoption">Adoption Events</option>
        <option value="foster">Foster Program</option>
        <option value="admin">Admin Support</option>
        <option value="other">Not sure yet</option>
      </select>
      
      <textarea placeholder="Tell us about your experience with animals..." rows="4" style="padding: 0.75rem; border: 1px solid var(--line); border-radius: 8px; font-family: inherit;"></textarea>
      
      <button type="submit" style="padding: 0.75rem; background: var(--gold); color: var(--pine); border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
        Submit
      </button>
    </form>
  </div>
</div>

<script>
(function() {
  const btn = document.getElementById('vol-signup-btn');
  const modal = document.getElementById('vol-modal');
  const closeBtn = document.getElementById('vol-modal-close');
  const form = document.getElementById('vol-signup-form');
  
  if (!btn || !modal) return;
  
  btn.addEventListener('click', () => {
    modal.style.display = 'flex';
    gtag('event', 'volunteer_signup', { step: 'modal_open' });
  });
  
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    try {
      const response = await fetch('/api/volunteer-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      
      if (response.ok) {
        gtag('event', 'volunteer_signup', { step: 'complete' });
        alert('Thanks for signing up! We\'ll be in touch soon.');
        modal.style.display = 'none';
        form.reset();
      } else {
        alert('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Error submitting form.');
    }
  });
})();
</script>
```

**Backend:** Need to create `/api/volunteer-signup` endpoint in `_worker.js`

```javascript
// In _worker.js, add this route:
app.post('/volunteer-signup', async (c) => {
  const data = await c.req.json();
  const { name, email, phone, interests, experience } = data;
  
  if (!name || !email) {
    return c.json({ error: 'Name and email required' }, 400);
  }
  
  // Send to email (or store in DB)
  try {
    // Option 1: Email to admin
    // (requires email integration; skip for now, just return success)
    
    // Option 2: Store in Neon
    const db = getDb(c.env);
    const [row] = await db.insert(volunteerSignupsTable).values({
      name,
      email,
      phone: phone || null,
      interests: interests || null,
      experience: experience || null,
      submittedAt: new Date().toISOString()
    });
    
    return c.json({ ok: true, id: row.id }, 201);
  } catch (err) {
    console.error('Volunteer signup error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// Add to Drizzle schema (after donationsTable):
export const volunteerSignupsTable = pgTable('volunteer_signups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  interests: text('interests'),
  experience: text('experience'),
  submittedAt: timestamp('submitted_at').notNull()
});
```

**Est. time:** 2 hours (HTML, JS, backend endpoint)

---

### 4.2 Foster/Adoption Application Improvements

**Current state:** Forms are on separate pages (`foster-apply.html`, `adopt-apply.html`).

**Improvements:**
1. **Add progress indicator** (Step 1 of 3, Step 2 of 3, etc.)
2. **Validate fields as user types** (e.g., email format, phone format)
3. **Show error messages inline** (not just border highlight)
4. **Add success screen** (not just form disappears)

**File:** `foster-apply.html` and `adopt-apply.html`

**Example progress indicator** (add to top of form):
```html
<div style="display: flex; gap: 1rem; margin-bottom: 2rem; align-items: center;">
  <div style="flex: 1; height: 4px; background: var(--gold); border-radius: 2px;"></div>
  <span style="color: var(--muted); font-size: 0.9rem;">Step 1 of 3</span>
</div>
```

**Inline validation** (on each input):
```javascript
const emailInput = document.querySelector('input[type="email"]');
emailInput.addEventListener('blur', () => {
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value);
  if (!isValid && emailInput.value) {
    emailInput.style.borderColor = 'var(--coral)';
    emailInput.nextElementSibling?.remove(); // remove old error
    const error = document.createElement('p');
    error.textContent = 'Please enter a valid email';
    error.style.color = 'var(--coral)';
    error.style.fontSize = '0.85rem';
    error.style.marginTop = '0.25rem';
    emailInput.parentElement.appendChild(error);
  } else {
    emailInput.style.borderColor = 'var(--line)';
    emailInput.nextElementSibling?.remove();
  }
});
```

**Success screen** (after form submit):
```html
<div id="success-screen" style="display: none; text-align: center; padding: 3rem;">
  <div style="font-size: 3rem; margin-bottom: 1rem;">✓</div>
  <h2 style="font-size: 1.8rem; color: var(--pine); margin-bottom: 0.5rem;">Application Submitted!</h2>
  <p style="color: var(--muted); margin-bottom: 2rem;">We'll review your application and be in touch within 3-5 business days.</p>
  <a href="/" style="padding: 0.75rem 1.5rem; background: var(--gold); color: var(--pine); text-decoration: none; border-radius: 8px; font-weight: 700;">Back to Home</a>
</div>
```

**Est. time:** 3 hours (both forms)

---

### 4.3 Hero/Secondary Page Visual Consistency

**Current state:** Hero sections on different pages have different layouts, colors, or styles.

**Standardize:**
1. All secondary page heroes (animals, volunteer, foster, etc.) should:
   - Use same gradient background (pine to pine-700)
   - Have same font sizes (h1 = 3rem, body = 1.1rem)
   - Have same padding (5rem vertical, 2rem horizontal)
   - Include breadcrumb or back button

2. Create a reusable `<section class="hero-secondary">` component

**CSS** (add to `styles.css`):
```css
.hero-secondary {
  background: linear-gradient(135deg, var(--pine) 0%, var(--pine-700) 100%);
  color: var(--cream);
  padding: 5rem 2rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.hero-secondary h1 {
  font-size: clamp(2.5rem, 8vw, 3.5rem);
  font-weight: 700;
  margin-bottom: 1rem;
  font-family: var(--display);
}

.hero-secondary p {
  font-size: 1.1rem;
  max-width: 700px;
  margin: 0 auto;
  opacity: 0.95;
  line-height: 1.6;
}

.hero-secondary .breadcrumb {
  font-size: 0.9rem;
  opacity: 0.8;
  margin-bottom: 2rem;
}
```

**Apply to all secondary pages:**
```html
<!-- Before: -->
<section style="background: ...; padding: ...;">
  <h1>Animals</h1>
  ...
</section>

<!-- After: -->
<section class="hero-secondary">
  <nav class="breadcrumb">
    <a href="/">Home</a> / <span>Our Animals</span>
  </nav>
  <h1>Our Animals</h1>
  <p>Meet the rescues living at Saint Francis Sanctuary</p>
</section>
```

**Est. time:** 2 hours (audit all pages, apply class)

---

### 4.4 Footer Navigation Accessibility

**Current state:** Footer nav links are small and hard to tap on mobile.

**Fix:**
```css
/* Add to styles.css: */
.foot-links a {
  display: block;
  padding: 0.75rem 0;
  min-height: 44px; /* WCAG touchpoint minimum */
  display: flex;
  align-items: center;
  transition: opacity .2s;
}

.foot-links a:hover {
  opacity: 0.8;
}
```

**On mobile, stack footer links vertically:**
```css
@media (max-width: 640px) {
  .foot-links {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .foot-links a {
    padding: 1rem 0;
  }
}
```

**Est. time:** 30 min

---

### 4.5 Deploy & Test

**Test checklist:**
- [ ] Volunteer modal opens/closes (click button, press Esc, click outside)
- [ ] Volunteer form submits and shows success screen
- [ ] Foster/adoption forms show progress indicator
- [ ] Form validation works (invalid email shows error)
- [ ] All secondary pages have consistent hero styling
- [ ] Footer links are tappable on mobile (44px min height)
- [ ] GA4 tracking fires on volunteer signup, form submit

**Commit:**
```bash
cd C:\Users\lawye\Projects\SaintFrancis-Website
git add *.html *.css app.js _worker.js
git commit -m "Phase 4: UX refinements

- Add inline volunteer signup modal (reduces friction)
- Add progress indicators to foster/adoption forms
- Improve form validation and error messaging
- Standardize hero sections across secondary pages
- Increase footer link tap targets to 44px (WCAG)
- Add GA4 event tracking for all form interactions

All forms tested end-to-end; GA4 verified."
```

**Deploy:**
```bash
npx wrangler pages deploy . --project-name=sfr-rescue --branch=main
```

**Success criteria:**
- [ ] Volunteer signups increase 20% (tracked via GA4)
- [ ] Form error rates decrease (fewer validation issues)
- [ ] Mobile bounces decrease (better navigation)

**Phase 4 complete.** Move to Phase 5.

---

## PHASE 5: Fundraising Psychology & Retention (Weeks 8–12)
**Est. 50 hours | Cost if outsourced: $2.5K–4K**

### 5.1 Add Social Proof Widgets

**Current state:** Donation page shows stats ("14+ years", "hundreds rescued") but no real-time social proof.

**Add: "Recent Gifts" feed** (bottom of donate page, before FAQ)

```html
<section style="padding: 3rem 2rem; background: var(--bone-2);">
  <div class="wrap" style="max-width: 800px; margin: 0 auto;">
    <h2 style="text-align: center; font-size: 1.6rem; margin-bottom: 2rem; color: var(--ink);">People like you are helping right now</h2>
    
    <div id="recent-gifts" style="display: grid; gap: 1rem;">
      <div style="background: var(--cream); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--gold);">
        <p style="margin: 0; font-size: 0.9rem; color: var(--muted);">Someone from Yuma, AZ</p>
        <p style="margin: 0.25rem 0 0; font-size: 1.1rem; font-weight: 700; color: var(--ink);">$50</p>
        <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--muted);">2 minutes ago</p>
      </div>
    </div>
  </div>
</section>

<script>
// Fetch recent donations from Neon (every 30s)
async function updateRecentGifts() {
  try {
    const response = await fetch('/api/recent-donations?limit=5');
    const gifts = await response.json();
    
    const container = document.getElementById('recent-gifts');
    container.innerHTML = gifts.map(gift => `
      <div style="background: var(--cream); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--gold);">
        <p style="margin: 0; font-size: 0.9rem; color: var(--muted);">${gift.location || 'A donor'}</p>
        <p style="margin: 0.25rem 0 0; font-size: 1.1rem; font-weight: 700; color: var(--ink);">$${(gift.amountCents / 100).toFixed(0)}</p>
        <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--muted);">${timeAgo(gift.createdAt)}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load recent gifts:', err);
  }
}

function timeAgo(isoDate) {
  const date = new Date(isoDate);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

updateRecentGifts();
setInterval(updateRecentGifts, 30000); // refresh every 30s
</script>
```

**Backend endpoint** (add to `_worker.js`):
```javascript
app.get('/recent-donations', async (c) => {
  const limit = Number(c.req.query('limit')) || 5;
  const db = getDb(c.env);
  
  const recent = await db
    .select({
      id: donationsTable.id,
      amountCents: donationsTable.amountCents,
      createdAt: donationsTable.createdAt,
      donorName: donationsTable.donorName
    })
    .from(donationsTable)
    .where(eq(donationsTable.source, 'zeffy'))
    .orderBy(desc(donationsTable.createdAt))
    .limit(limit);
  
  // Anonymize names, show only city/state if available
  return c.json(recent.map(d => ({
    ...d,
    donorName: 'A donor', // privacy
    location: 'Arizona' // generic location
  })));
});
```

**Est. time:** 2 hours

---

### 5.2 Add Matching Gift Campaign

**Concept:** "Double your impact — we have a $5K match!"

**Add banner to donate page** (above impact slider):

```html
<div style="background: linear-gradient(135deg, var(--gold), var(--clay)); color: var(--pine); padding: 2rem; border-radius: 16px; margin-bottom: 2rem; text-align: center;">
  <p style="margin: 0; font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">⚡ Limited Time Offer</p>
  <h2 style="margin: 0.75rem 0 0; font-size: 1.8rem; font-weight: 800;">Your gift will be matched!</h2>
  <p style="margin: 0.75rem 0 0; font-size: 1rem;">A generous donor has pledged to match up to $5,000. Donate now to double your impact.</p>
  
  <div style="margin-top: 1.5rem; background: rgba(0,0,0,.1); padding: 1rem; border-radius: 12px;">
    <p style="margin: 0; font-size: 0.95rem;"><strong>$2,847</strong> of $5,000 matched</p>
    <div style="margin-top: 0.75rem; height: 8px; background: rgba(0,0,0,.2); border-radius: 4px; overflow: hidden;">
      <div style="width: 57%; height: 100%; background: rgba(0,0,0,.3); border-radius: 4px;"></div>
    </div>
  </div>
</div>

<script>
// Update progress bar daily (or every hour)
async function updateMatchProgress() {
  try {
    const response = await fetch('/api/match-progress');
    const { raised, goal } = await response.json();
    const percent = Math.min((raised / goal) * 100, 100);
    
    document.querySelector('[style*="width: 57%"]').style.width = percent + '%';
    document.querySelector('strong').textContent = '$' + raised.toLocaleString();
  } catch (err) {
    console.error('Failed to update match progress:', err);
  }
}

updateMatchProgress();
setInterval(updateMatchProgress, 3600000); // refresh hourly
</script>
```

**Backend endpoint:**
```javascript
app.get('/match-progress', async (c) => {
  const db = getDb(c.env);
  
  const result = await db
    .select({ total: sql`SUM(amount_cents)` })
    .from(donationsTable)
    .where(eq(donationsTable.source, 'zeffy'));
  
  const raised = Math.floor((result[0]?.total || 0) / 100);
  const goal = 5000;
  
  return c.json({ raised, goal, percent: (raised / goal) * 100 });
});
```

**Email campaign:**
- Day 1: "Help us unlock a $5K match"
- Day 5: "We're 50% of the way there"
- Day 10: "Only $2.5K to go"
- Last day: "Final day to double your gift"

**Est. time:** 3 hours (design, backend, email sequence)

---

### 5.3 Add Donor Recognition (Anonymous Donor Wall)

**Concept:** Show recent $50+ donors on homepage to build social proof (optional, with consent)

**On `index.html`, after impact strip:**

```html
<section style="padding: 4rem 2rem; background: var(--cream);">
  <div class="wrap">
    <h2 style="text-align: center; font-size: 1.8rem; margin-bottom: 0.5rem; color: var(--ink);">Supporters making a difference</h2>
    <p style="text-align: center; color: var(--muted); margin-bottom: 2rem;">Last 30 days</p>
    
    <div id="donor-wall" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
      <!-- Populated by JS -->
    </div>
  </div>
</section>

<script>
async function loadDonorWall() {
  try {
    const response = await fetch('/api/donor-wall');
    const donors = await response.json();
    
    const wall = document.getElementById('donor-wall');
    wall.innerHTML = donors.map(d => `
      <div style="background: linear-gradient(135deg, rgba(78,255,197,.1), rgba(212,175,122,.05)); padding: 1.5rem; border-radius: 12px; border-left: 4px solid var(--gold); text-align: center;">
        <p style="margin: 0; font-size: 0.9rem; color: var(--muted);">${d.name}</p>
        <p style="margin: 0.5rem 0 0; font-size: 1.3rem; font-weight: 800; color: var(--gold);">$${d.amount}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load donor wall:', err);
  }
}

loadDonorWall();
</script>
```

**Backend endpoint:**
```javascript
app.get('/donor-wall', async (c) => {
  const db = getDb(c.env);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const donors = await db
    .select({
      donorName: donationsTable.donorName,
      amountCents: donationsTable.amountCents
    })
    .from(donationsTable)
    .where(
      and(
        eq(donationsTable.source, 'zeffy'),
        gte(donationsTable.createdAt, thirtyDaysAgo.toISOString()),
        gte(donationsTable.amountCents, 5000) // $50+
      )
    )
    .orderBy(desc(donationsTable.createdAt))
    .limit(12);
  
  return c.json(donors.map(d => ({
    name: d.donorName || 'Anonymous',
    amount: Math.round(d.amountCents / 100)
  })));
});
```

**Est. time:** 2 hours

---

### 5.4 Add Monthly Impact Email Series

**Current state:** Zeffy webhook adds subscribers, but no ongoing impact updates.

**In Mailchimp, create monthly automation:**

| Email | Trigger | Subject | Content |
|-------|---------|---------|---------|
| #1 | Day 1 of month | "January Impact: 47 animals fed" | Stats from prior month + story |
| #2 | Day 15 | "Highlight: Meet Luna" | Feature one animal, show what needs |
| #3 | Day 25 | "Help us reach $X this month" | Fundraising push if behind goal |

**Template example:**
```
Subject: January Impact: 47 animals fed

Hi *|FNAME|*,

Because of donors like you, here's what we accomplished in January:

📊 BY THE NUMBERS
• 47 animals fed daily
• 12 vet visits completed
• 3 animals rehomed to forever families

🐴 MEET BAILEY
Bailey arrived malnourished and scared. After 6 weeks of care, he's thriving.
[Read Bailey's story & see photos]

💚 NEXT MONTH
To keep this going, we need $8K for February feed and vet care.
[Donate $25, $50, or $100]

Thank you for being part of this,
Saint Francis Rescue

P.S. Gifts of any size help. Even $10 feeds an animal for a week.
```

**Setup in Mailchimp:**
1. Create new automation: "Trigger: Signup date + 30 days"
2. Title: "Monthly Impact — Day 1"
3. Send the template above
4. Schedule second email 14 days later
5. Schedule third email 24 days later

**Est. time:** 1.5 hours (Mailchimp UI)

---

### 5.5 Add FAQ Optimization

**Current state:** `/faq.html` exists, but may not address donor concerns.

**Add these FAQ items** (if missing):

```html
<details class="faq-item">
  <summary class="faq-question">How much of my donation goes to animal care?</summary>
  <div class="faq-answer">100%. We're 100% volunteer-run with zero paid staff, so your entire donation supports food, vet care, shelter, and supplies. We're a registered 501(c)(3) nonprofit (EIN 99-0599742).</div>
</details>

<details class="faq-item">
  <summary class="faq-question">Can I donate monthly?</summary>
  <div class="faq-answer">Yes! Monthly donors are our lifeline. Even $10/month helps us plan feed purchases and routine vet care with confidence. <a href="/donate" style="color: var(--gold); text-decoration: underline;">Set up a monthly gift now.</a></div>
</details>

<details class="faq-item">
  <summary class="faq-question">How will I know my donation helped?</summary>
  <div class="faq-answer">We'll email you monthly updates showing: animals we've rescued, how many people volunteered, and real stories of impact. You can also follow us on <a href="https://instagram.com/saintfrancisrescueandsanctuary" style="color: var(--gold);">Instagram</a> for daily updates.</div>
</details>

<details class="faq-item">
  <summary class="faq-question">Is my donation tax-deductible?</summary>
  <div class="faq-answer">Yes. Saint Francis Rescue is a registered 501(c)(3) nonprofit. All donations are fully tax-deductible. Your receipt is sent automatically by Zeffy.</div>
</details>

<details class="faq-item">
  <summary class="faq-question">What if I want to cancel my monthly gift?</summary>
  <div class="faq-answer">You can cancel anytime through Zeffy's donor portal (you'll receive a link in your receipt email), or email contact@saintfrancisrescue.org and we'll help.</div>
</details>
```

**Add schema markup** (for Google rich results):
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How much of my donation goes to animal care?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "100%. We're 100% volunteer-run with zero paid staff..."
      }
    }
    /* repeat for each FAQ */
  ]
}
</script>
```

**Est. time:** 1 hour

---

### 5.6 Donor Retention Metrics

**In GA4, create a segment:** "Repeat Donors" (users with 2+ donate_click events within 90 days)

**Track:**
- New donors this month (1st time donation)
- Repeat donors (2+ donations)
- Churn rate (who haven't donated in 90 days)

**Monthly review:**
- If repeat donor % < 15%, email campaign isn't working → adjust content
- If churn > 30%, impact updates aren't compelling → add more stories

**Est. time:** 30 min setup

---

### 5.7 Deploy & Test

**Test checklist:**
- [ ] Recent gifts feed updates every 30s
- [ ] Matching campaign banner shows correct progress
- [ ] Donor wall displays on homepage
- [ ] Monthly impact emails send on schedule (test in Mailchimp)
- [ ] FAQ items load and expand/collapse
- [ ] GA4 tracks repeat donors

**Commit:**
```bash
cd C:\Users\lawye\Projects\SaintFrancis-Website
git add *.html *.css app.js _worker.js
git commit -m "Phase 5: Fundraising psychology and retention

- Add real-time 'Recent Gifts' social proof feed
- Implement matching gift campaign with progress bar
- Create donor wall (anonymous $50+ donors)
- Set up monthly impact email automation
- Expand FAQ with donor retention FAQs
- Add schema markup for SEO

All integrations tested; email sequences verified in Mailchimp.
Donor retention metrics configured in GA4."
```

**Deploy:**
```bash
npx wrangler pages deploy . --project-name=sfr-rescue --branch=main
```

**Success criteria:**
- [ ] Donation click-through rate increases 15% (GA4)
- [ ] Newsletter unsubscribe rate < 0.5% (Mailchimp)
- [ ] Repeat donor rate increases from 0% to 15%+ (GA4)
- [ ] Average donation increases 10% (Neon)

**Phase 5 complete.** 🎉

---

## 📊 Post-Roadmap Success Metrics

**30 days after Phase 5 completion, measure:**

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| Monthly donations | TBD | +25% | GA4 + Zeffy |
| Volunteer signups | TBD | +40% | GA4 volunteer_signup event |
| Foster applications | TBD | +20% | GA4 application_complete |
| Newsletter subscribers | 0 | 100+ | Mailchimp |
| Repeat donor rate | 0% | 15%+ | GA4 segment |
| Email open rate | — | 25%+ | Mailchimp |
| Mobile traffic | — | 40%+ | GA4 device breakdown |
| Accessibility issues | — | 0 critical | Axe DevTools |

---

## 💰 Budget Summary

| Phase | Estimate | DIY | Outsource |
|-------|----------|-----|-----------|
| 1: Accessibility | 40 hrs | Free | $2–3K |
| 2: Email Funnel | 30 hrs | $0 (Mailchimp free) | $1.5–2.5K |
| 3: Analytics | 20 hrs | Free (GA4) | $1–2K |
| 4: UX Refinements | 60 hrs | Free | $3–5K |
| 5: Fundraising | 50 hrs | Free | $2.5–4K |
| **TOTAL** | **200 hrs** | **~$0** | **$10–17K** |

---

## 🚀 Execution Tips

1. **Pick one phase at a time** — don't try all 5 simultaneously
2. **Test locally first** — use http://localhost:5175 to verify before deploying
3. **Deploy Friday afternoon** — gives time to roll back if issues appear Monday
4. **Use checklists** — copy each section's "Success criteria" into Notion/Asana to track progress
5. **Review metrics weekly** — use the GA4 dashboard to catch problems early

---

**Ready to begin Phase 1? Let me know!**
