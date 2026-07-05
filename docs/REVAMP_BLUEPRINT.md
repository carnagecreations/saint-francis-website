# Saint Francis Rescue — Revamp Blueprint
## Website + SanctuaryBase v2 Integrated Nonprofit Management Platform

*Synthesized from nine expert reviews: UX (Rados), visual design (Willeck), SEO/content, analytics (Whole Whale-style), accessibility ×2 (Intopia-style, Knowbility-style), fundraising (Donorbox-style), volunteer/CMS workflow (Morweb-style), and architecture/security (Robintek-style).*

---

## 1. Executive Summary

Saint Francis Rescue operates two codebases that are marketed as one system but function as two. The public website (`C:/Users/lawye/Projects/SaintFrancis-Website` — static HTML + a Cloudflare Worker with Hono/Drizzle/Neon in `_worker.js`) is a genuinely excellent brochure: strong emotional copy, solid on-page SEO fundamentals, real accessibility investment, and high-converting donation persuasion. The internal app (`C:/Users/lawye/Projects/SB- v2` — Vue 3 + Pinia + Firestore + Cloudflare Pages Functions) is an ambitious ~50-page operations suite with a real component library, a documented token system, and one exemplary integration pattern: the server-side proxy (`functions/api/site/[[path]].js` + `_shared/verifyRole.js`) that verifies Firebase roles server-side and forwards to the website's admin API without ever exposing `SITE_ADMIN_TOKEN` to the browser.

The integration, however, is one-way and lossy — every expert independently converged on the same verdict. Outbound (app → site), animal listings and auction items publish cleanly via `WebsiteListingTab.vue`. Inbound (site → app), the org's three highest-value flows are broken: **adoption/foster/volunteer applications are flattened into four columns** (`name, email, subject, message`) by `_worker.js`'s `POST /contact` (~line 14655), destroying phone numbers, addresses, and every screening answer at the moment of submission; **donations exit to Zeffy with no webhook or import**, so the donor CRM, ledger, and finance dashboards run on hand-entered and seeded data; and **the app's ApplicationsPage operates entirely on phantom seed data** (Firestore `applications` collection populated by `seedApplications.js`) that real website applicants never reach. Meanwhile the Inbox's "Send reply" button writes a `reply` column to Neon and sends no email — staff believe they've responded; applicants are ghosted.

Beneath the integration gaps are structural blockers: no router (tab-state navigation with a hard-coded demo animal fallback on refresh), a 1.18 MB monolithic JS bundle, six unauthenticated Cloudflare Functions including an open email relay and an arbitrary R2 delete endpoint, Firestore rules that let any self-registered volunteer read the donor CRM and all direct messages, and an app-wide accessibility posture (no focus indicators, no dialog semantics, silent toasts) that fails WCAG at the primitive level. The two properties also share zero brand identity — warm pine/bone/Fraunces on the site, dark purple/neon-mint/Fredoka in the app.

**Overall verdict:** the foundations are unusually good for a volunteer-run org — the proxy pattern, the token architecture, the store conventions, and the website's craft are all worth building on. But the "powerhouse" mandate cannot be met by adding features. The system currently loses its most valuable data (applications, donations) at the front door, and its workflow modules operate on data that isn't real. The revamp must first make the pipes carry structured truth end-to-end, then build modules on top. Everything else is theater until the org can (a) receive a complete application, (b) reply to it and have the reply actually arrive, and (c) see a real donation in its own ledger.

---

## 2. What Already Works and Must Be Preserved

**Integration chassis (extend, don't replace):**
- The server-side proxy pattern: `SB- v2/functions/api/site/[[path]].js` + `functions/_shared/verifyRole.js` — Firebase ID token verified against the Firestore role server-side, site admin token kept as a Pages secret, role-scoped path allowances, byte-for-byte multipart passthrough. Flagged as the correct template by 5 experts. All new site↔app flows (applications, donations, stats, stories) should reuse this channel.
- The animal publish workflow: `animalsAdmin.js` + `WebsiteListingTab.vue` with `siteAnimalId` linking and `importFromSite()` reconciliation, plus the AI bio writer (`generate-animal-bio.js`).
- `admin.html` retired to a redirect stub — one admin surface, one attack surface.
- Newsletter capture: pre-footer form → `POST /api/newsletter` → Neon with dedupe and `source` attribution → read-only in the app. The working template for how every other inbound flow should look.

**Website (preserve wholesale):**
- Emotional design and copy: story-led voice, impact-anchored donation tiers, resident-animal framing, expectation-setting confirmations. The org brand identity — pine `#1f3a2e`, bone `#f4efe6`, gold, clay, Fraunces/Hanken Grotesk, self-hosted woff2, paper-grain texture — is the identity the whole ecosystem should adopt.
- Front-end craft: skip links with focusable `<main>`, `SF.announce()`/`SF.toast()` live region, the animal-modal focus trap (`app.js:541-584`), keyboard-activatable animal cards, extensive `prefers-reduced-motion` coverage, honeypot instead of CAPTCHA.
- SEO fundamentals: unique titles/metas/canonicals on all pages, NGO/AnimalShelter JSON-LD with taxID, FAQPage schema, DonateAction schema, breadcrumbs.
- Performance/security posture: preloads, webp, tight CSP + HSTS in `_headers`, immutable caching.
- `volunteer-signup.html`'s form engine — the best form in either codebase (fieldset/legend per step, `aria-invalid`, `role=alert` errors, `aria-pressed` pills, accommodation question). This is the generalization target for all multi-step forms.
- The `SF.track` abstraction (`app.js:100-115`) and consistent UTM discipline on every Zeffy link.

**App (preserve architecture, fix values):**
- The token *architecture* in `design-tokens.css` (semantic families, light/dark/faint/glow variants, motion tokens, `--shadow-focus`, reduced-motion/contrast support) — only the values and adoption need work.
- The `ui/` component library with barrel export and README rules; `AppInput`/`AppSelect` already enforce 44px min-height.
- Role-based navigation (`BottomNav.vue` role tab sets, `adminOnly` filtering) — right model, needs pruning.
- Firestore rules *fundamentals*: default-deny catch-all, role in `users/{uid}` with no self-escalation, `roleInvites` verified inside rules via `get()`.
- `recurringTasks.js`'s period-key generation pattern; `tasks.js`'s guarded `onSnapshot` subscription; `VolunteerHub.vue`'s claim/complete task loop; the Inbox's polish (unread logic, filter tabs, armed delete).
- Documentation culture (`ARCHITECTURE.md`, `CODEBASE_MAP.md`, `DESIGN_SYSTEM.md`) and the uniform store-per-domain Pinia pattern — the revamp is tractable because of these.

---

## 3. Critical Issues (Deduplicated, With Evidence)

Ordered by severity × breadth of expert consensus.

### C1. Application data is destroyed at the API boundary — flagged by all 9 experts
`adopt-apply.html:464-509`, `foster-apply.html:~452`, and `volunteer-signup.html:792-846` collect 11–18 structured fields (phone, address, experience, living setup, availability, guardian/minor flags, accessibility needs) and submit via `SF.sendContact` → `POST /api/contact`. `_worker.js:14655` inserts only `name, email, subject, message`. The phone number required to keep the site's "we'll call within 48 hours" promise never reaches storage. `volunteer-signup.html` additionally swallows all fetch errors (`.catch(function(){})`) and shows the thank-you screen regardless — failed submissions are silently lost (Morweb, Robintek).

### C2. Two disconnected application pipelines; the workflow UI runs on phantom data — Rados, Willeck, Whole Whale, Morweb, Robintek, SEO
`ApplicationsPage.vue`/`AdoptionsPage.vue` read the Firestore `applications` collection populated only by seed scripts; real applicants land in the Inbox as flattened contact rows. `denyVolunteer`/`denyAdoption` (`ApplicationsPage.vue:127-137`) call `store.deleteApplication` — denial **erases the record** (no reason, no history, no funnel metrics). In-app `VolunteerSignup.vue` bypasses review entirely, writing `people` records with `status:'active'` (line 449). The website runs two competing volunteer funnels (`volunteer.html` → app signup vs `volunteer-signup.html` → contact blob) with different taxonomies and forced double entry.

### C3. Six unauthenticated Cloudflare Functions, including arbitrary R2 delete and an open email relay — Robintek
`SB- v2/functions/api/`: `delete-document.js` (deletes any object in `GRANTS_BUCKET` via `?key=`), `upload-document.js`, `get-documents.js`, `vet-chat.js`, `generate-loi.js`, `send-reminder.js` (arbitrary to/subject/body — spam under the org's domain) have **no auth**. `verifyCallerRole` already exists and is proven in the site proxy; it simply isn't applied. This is the single most urgent fix in either codebase.

### C4. Firestore rules leak donor, finance, and private-message data to every volunteer — Robintek
`firestore.rules`: `ledgers`, `donors`, `donations`, `financeStats`, `grants`, `biteReports`, `eodReports`, and `messages` all `allow read: if isAuth()`. Any self-registered volunteer account can read the full donor CRM, complete financials, incident reports, and everyone's DMs, and can update any task/swap/event/supply record.

### C5. Inbox "Send reply" never contacts anyone — Rados (corroborated by Donorbox's email-infrastructure survey)
`contactsService.js` `replyToContact()` PATCHes `{reply: text}` to a Neon column; `Inbox.vue` shows "✓ Replied." No email is ever sent — the website worker has zero email code, and the app's only mailer is the unauthenticated `send-reminder.js`. Staff diligence is converted into applicant ghosting.

### C6. Donations are a black hole; three unreconciled sources of financial truth — Donorbox, Whole Whale, Robintek, Willeck, SEO
Every donate CTA links to one generic Zeffy form; no webhook, import, or CSV path exists (`grep zeffy` in SB- v2 returns nothing). The impact slider captures amount + monthly intent and **discards both at handoff** (`donate.html:391-448` opens the bare Zeffy URL). Inside the app: `donors.js` (flat CRUD, amounts stored as strings like `"$50"`, duplicates on every entry), `ledger.js`, and `financeStats.js` (seeded sample data) never reference each other. `FinanceStatsPage.vue:101-107` computes "Active Donors" from description strings of the last 10 transactions. "Send Thank You" and "View History" buttons have no handlers. `GrantsPage.vue:167-170` holds the entire grant pipeline in plain `ref([])` — **all data lost on refresh**.

### C7. No router; refresh shows a fabricated animal — Rados, Knowbility, Robintek
No vue-router; navigation is `ui.currentTab` (50 statically imported pages in `App.vue:37-139`). Back button exits the app, nothing is deep-linkable, and `AnimalDetail.vue` (~line 211) falls back to a hard-coded demo animal ("Luna") when state is lost — **fabricated data in a medical context**. Screen-reader users get zero navigation feedback (no title change, focus move, or announcement — Knowbility).

### C8. The app fails WCAG at the primitive level — Knowbility (Intopia recommends extending the audit)
`AppButton.vue:42` sets `outline: none` with no `:focus-visible` replacement (zero `focus-visible` hits in `src/`); no modal (~20 hand-rolled overlays incl. `ConfirmDialog.vue`, `DietModal.vue`) has `role=dialog`, focus trap, or Escape; `Toast.vue` — the app's sole feedback channel — has no `aria-live` (a silently failed "meds given" save is a safety issue); `AppInput`/`AppSelect` labels associate with nothing. Light-mode mint `#0FA87D` on white is ~2.9:1.

### C9. Website conversion pages have bolt-on WCAG failures — Intopia
Mouse-only clickable divs on `adopt-apply.html:402` (animal grid uses `onclick` + `alert()`) and the volunteer time selector (`app.js:444-457`); the adopt/foster `.error` class styles nothing and sets no ARIA (`styles.css` has only `.field.invalid`, which is never set); unassociated labels on all quick-interest widgets; the unnamed monthly/one-time donation toggle (`donate.html:224-232`); exit-intent overlay declares `aria-modal` without trapping focus; the gold focus ring is ~2.2:1 on cream backgrounds.

### C10. No indexable per-animal pages, and all SEO equity accrues to `sfr-rescue.pages.dev` — SEO lead
Animal listings are client-rendered JSON with hash URLs (`app.js:385`); no per-animal HTML route, title, OG image, or schema exists — the single largest organic-traffic loss for an adoption org. Every canonical/sitemap/schema URL points at the Cloudflare subdomain while the site's own UTMs reference `saintfrancisrescue.org`. Also: `SEO_IMPROVEMENTS.md` materially misrepresents what shipped (claims image sitemap, AggregateRating, manifest removal — none present; the fake AggregateRating would have violated Google guidelines anyway).

### C11. Hour tracking is duplicated and personal stats are wrong — Morweb
Two parallel systems: `shifts.js` (`shifts` collection, decimal hours) vs `clockIn.js` (`checkins` collection, minutes) — totals disagree depending on which button was used. `shifts.js:15`: `volunteerShifts = computed(() => shifts.value)` — "my shifts" returns **everyone's** shifts. The `volunterId` typo is baked into stored documents. Waiver promises to minors ("we'll email your guardian") have no implementing code.

### C12. Performance/scale debt — Robintek, Rados
1.18 MB JS bundle (`dist/assets/index-BKSqHvuh.js`), no code splitting, empty `vite.config.js`; 46 unbounded `getDocs()` calls across 29 stores; no offline persistence or service worker despite `volunteer.html:249` promising "works offline too"; the website worker is a 492 KB compiled bundle committed as source with routes hand-edited inside it; public forms have no server-side bot protection or rate limiting; `MorningRoundsPage.vue` is a lose-everything monolith and `FeedingLogPage.vue:122`'s "✓ Fed" button has no click handler.

### C13. Public numbers are hard-coded; analytics config is stale — SEO, Whole Whale
`/api/stats` returns `yearsActive:14, animalsRescued:300, volunteers:22` as literals; `adoptedThisYear` filters on animal `createdAt` year, not adoption date. Zero `SF.track` calls on any application form's success handler. Plausible `data-domain` still `sfr-rescue.pages.dev` post-domain-move; the app sends `userId` as a Plausible event prop. (Adjudication: Donorbox reported `SF.track` as a no-op with analytics commented out; Whole Whale cites the live script at `index.html:25`. Both point the same direction — **verify what's actually deployed, then fix the data-domain and define goals**; the remediation is identical either way.)

### C14. Two brands, three styling systems, unfinished token migration — Willeck
Zero shared tokens/fonts/colors between properties. Inside the app: ~100 of 109 `.vue` files use legacy token names that survive only via the shim in `style.css:13-59`; Tailwind v4 is installed and imported but used in ~3 files; raw `<button>` in 57 of ~70 feature files; 158 hardcoded hex occurrences; theme persistence split across three writers with a dead `'theme'` localStorage key (`ui.js:32` vs `'sb_theme'` elsewhere).

---

## 4. The Powerhouse Vision — Target Module Map

SanctuaryBase becomes the **system of record** for all operational and relationship data; the website becomes its **public rendering and intake surface**, connected through structured APIs in both directions.

| Module | Exists today | Must be built |
|---|---|---|
| **Animal Care & Medical** | Animals store, AnimalDetail (16 flat tabs), feeding/rounds/meds pages, quarantine, vet hub, compliance alerts on Dashboard | Consolidate to ~6 grouped sections with a **unified chronological medical timeline** (Health+Meds+Vaccines+Weight+Records+Vet merged); per-animal resumable rounds; fix dead "✓ Fed" button; derive outcomes automatically from status transitions; sanctuary-appropriate metrics (per actual species, permanent residents separated from adoptables) |
| **People CRM (unified persons)** | Fragmented: `users` (uid), `people` (email/name), `waivers`, `donors`, `contacts` — unlinked | One canonical person entity keyed to uid, with roles/facets (volunteer, adopter, donor, applicant, board), dedupe-by-email, timeline of every touchpoint (application, gift, message, shift), "convert inquiry → donor/applicant" actions in Inbox |
| **Applications Pipeline** | Broken twice over (C1, C2) | Typed `POST /api/applications` (adoption\|foster\|volunteer, full payload, `animal_id`); one pipeline module with stages New → Reviewing → Interview → Home check → Approved → Adopted / Declined-with-reason; **deny is a status, never a delete**; linked to animal + person records; applicant status emails; public status page |
| **Fundraising & Donor Management** | Flat `donors` store with dead buttons; Zeffy silo; UTM discipline on links; in-memory grants; AI LOI generator | Separate `donations` collection (integer `amountCents`, method, frequency, campaign, fund, `receiptSentAt`); Zeffy webhook/CSV ingestion with donor upsert; derived rollups (LTV, YTD, LYBUNT/SYBUNT); campaigns + pledges with public thermometers via the proxy; persisted grants pipeline with deadlines and award→ledger linkage; auction bids table with current-high-bid display |
| **Finance** | Duplicate `ledger` + seeded `financeStats` collections | One ledger source of truth (it has `ledger.schema.json`); migrate financeStats in; rebuild FinanceStatsPage as computed views; `donorId`/`grantId`/`campaignId` foreign keys for restricted-fund and 990-ready reporting |
| **Volunteer Ops** | Task claim loop (keep), roleInvites (keep), two intake funnels, two hour systems, no bookable shifts | Single intake (website form → applications); lifecycle state machine (applied → approved → waiver_signed → orientation → active); unified `timeEntries` collection (fix `volunterId` typo and all-shifts leak); capacity-based bookable shift slots gated on certifications; recognition (milestones, annual hours letters) |
| **Compliance & Risk** | Text-signature waivers, hardcoded version, biteReports store | Versioned waivers with re-sign triggers and expiry; the promised guardian email flow for minors; training/certification records with expiry that scheduling enforces; incident workflow tied to persons and animals |
| **Communications** | Nothing real: fake reply button, unauthenticated `send-reminder.js`, mailto links | Authenticated email service (Cloudflare Email Service or Resend) with templates (application received/decision, donation receipt with IRS language and EIN 99-0599742, year-end statements, shift reminders, guardian waivers); every send logged to the person's timeline; make Inbox "Send reply" actually send |
| **Reporting & Analytics** | Honest telemetry exists in pockets (volunteer hours, fed-today); board metrics are wrong or seeded | Board-ready Reports hub computed from canonical data: donor retention, cost per animal, adoption rate & length of stay, application funnel conversion, volunteer retention, list growth by source; CSV export; attribution (UTM/referrer) captured on every inbound record |
| **Website Integration & Public Content** | Publish pipeline for animals/auctions (keep); hardcoded stats; no editorial surface | Server-rendered per-animal pages with schema/OG; dynamic sitemap/robots from the DB; live `/api/stats` fed from app data; a Stories/News publisher in the app (mirroring WebsiteListingTab) pushing to a Neon `stories` table with Article schema; event pages with Event schema; alt-text required before an animal can go "available" |

---

## 5. Architecture Decisions Required Before Building

**D1 — Adopt vue-router now.** Unanimous among the three experts who examined navigation. Knowbility's "minimally, add announcements" fallback is rejected: the migration is mechanical (`App.vue`'s `routeMap` is already a router table), and a router simultaneously fixes back/refresh/deep-links, enables per-route code splitting (D4), provides the natural hook for focus/title management (accessibility), and gives future email links (`/applications/123`) somewhere to land. Delete the Luna demo fallback in `AnimalDetail.vue`; missing state fetches by route param or shows not-found.

**D2 — One system of record per domain, connected by the proven proxy.** Firestore remains the operational system of record (animals, people, applications workflow, finance); Neon remains the public-content and intake store (published animals, stories, contact/application intake, newsletter, bids). Intake flows land structured in Neon (`jsonb` payloads / typed tables) and sync into Firestore through the existing `functions/api/site` proxy pattern — the same channel animals already use, run in reverse. Experts split between "worker forwards to Firestore" and "app pulls via proxy"; **pull-via-proxy wins** because the auth machinery already exists and no Firebase Admin credentials enter the website project. Retire `financeStats` (merge into `ledger`) and the seeded `applications` data.

**D3 — Security before features.** Apply `verifyCallerRole` to all six open functions (documents = admin; vet-chat/LOI = staff; send-reminder = staff + allowlisted sender). Re-tier Firestore reads: donors/ledgers/donations/financeStats/grants/biteReports → `isPrivileged()`; messages → sender/recipient only; tighten `isAuth()` writes on tasks/swaps/events/supplies. Add Turnstile + per-IP rate limiting to `/api/contact`, `/api/newsletter`, `/api/suggestions`. Delete the vestigial `/admin/login` token-echo route (`_worker.js:14856`). None of the powerhouse modules (donor PII, finances, minors' data) can responsibly be built before this lands.

**D4 — Un-bundle and split.** Extract the website worker's ~500 real route lines (from ~14625) into a buildable `src/worker/` project (Hono + Drizzle as npm deps, wrangler/esbuild build) — a prerequisite for `/api/applications`, webhooks, and server-rendered animal pages. In the app: route-level dynamic imports + `manualChunks` (firebase/vue/pinia vendors), target <300 KB initial JS; `initializeFirestore` with `persistentLocalCache` + service worker/PWA so "works offline" becomes true; a shared `createCollectionStore` factory with pagination (`orderBy`/`limit`/`startAfter`) for the ~40 near-identical stores.

**D5 — Communications infrastructure is a platform service, not a feature.** One authenticated email service with templating and per-person send logging, consumed by applications, receipts, waivers, shift reminders, and Inbox replies. Until it exists, every "reply/notify/acknowledge" affordance must be removed or clearly labeled — false affordances (C5) are worse than absent ones.

**D6 — One brand, one styling system.** Adopt the website's Saint Francis identity as the shared brand token layer (pine/bone/gold/clay, Fraunces/Hanken, self-hosted woff2); light "sanctuary paper" becomes the app default, dark mode rebuilt as deep-pine night theme. Keep the app's token *architecture*; change values via the existing shim, then codemod legacy names (`--mint`, `--ink`, etc.) to `--color-*` starting with the `ui/` library, and delete the shim. **Drop Tailwind** (Willeck; no expert dissents — installed, imported, used in ~3 files): one system a small team fully understands beats two half-used. Enforce with stylelint (no raw hex, no unknown custom properties). Convert the px font scale to rem with ~15–16px effective base. Collapse `DESIGN_SYSTEM.md` + `ui/README.md` into one doc that matches the code.

**D7 — Move to the custom domain first.** Attach `saintfrancisrescue.org`, bulk-update canonicals/schema/sitemap/robots, 301 `pages.dev`, re-verify GSC, fix the Plausible `data-domain` — **before** any content or SEO investment, so new equity lands on the real domain.

---

## 6. Phased Roadmap

### Phase 1 — Foundations: stop the bleeding, secure the base (weeks 1–6)

Ordered; items 1–3 are emergency-grade.

1. **Lock down the functions layer** (D3): auth on all six open functions; Firestore read re-tiering; delete `/admin/login`. *Rationale: active exposure of donor data, R2 deletion, and an open relay.*
2. **Stop application data loss**: persist the full JSON payload from adopt/foster/volunteer forms (a `jsonb details` column on contacts, or an interim `applications` table) so nothing more is destroyed while the real pipeline is designed. Fix `volunteer-signup.html`'s swallowed errors so failures are visible. *Rationale: one-line-ish worker change; every day of delay loses irreplaceable applicant data.*
3. **Disarm false affordances**: until email exists, change Inbox "Send reply" to an honest "Log internal note" + prominent mailto; remove or wire the dead "✓ Fed", "Send Thank You", "View History" buttons. Reconcile donate.html's receipt hero/FAQ contradiction. *Rationale: staff currently believe work is happening that isn't.*
4. **Custom domain migration + analytics fix** (D7): domain, 301s, GSC, Plausible data-domain, add `SF.track` success events on all three application forms, drop `userId` from app Plausible props.
5. **Un-bundle the website worker** (D4) into buildable source. *Prerequisite for everything in Phase 2.*
6. **Adopt vue-router** (D1) with lazy-loaded routes, role guards, and the Luna fallback removed; `manualChunks` vendor splitting.
7. **Fix the four app primitives** (Knowbility's leverage play): `AppButton` `:focus-visible` via `--shadow-focus`; `AppInput`/`AppSelect` id/for wiring + `aria-invalid`/`aria-describedby` + real clear button; `Toast.vue` `role=status`/`alert`; build `AppModal`/`AppDrawer` (dialog semantics, trap, Escape) and begin migrating the ~20 overlays. *Days of work; hundreds of screens inherit the fix.*
8. **Website WCAG money-page fixes** (Intopia's four): name the monthly toggle; trap the exit-intent overlay (reuse `app.js:571-583`); make the adopt-grid and time-selector real keyboard controls; wire `initInlineValidation` beyond `#contact-form`. Add dual-tone focus ring tokens (pine/clay on light, gold on dark).
9. **Turnstile + rate limiting** on public endpoints; templatize the shared header/footer (build-time includes) to stop the documented markup drift across 20+ pages.
10. **Data hygiene**: fix `shifts.js:15` all-shifts leak and the `volunterId` typo (with migration); change application deny from delete to status transition immediately, even on the seed-data page.

### Phase 2 — Core modules: one pipeline, real money, real email (weeks 6–16)

1. **Communications service** (D5): authenticated sender + templates + per-person send log. Make Inbox "Send reply" genuinely send. Automatic acknowledgment on every form submission. *First, because every module below has a notification step.*
2. **Unified Applications Pipeline**: typed `POST /api/applications` on the rebuilt worker; app ingests via the site proxy into one pipeline module replacing ApplicationsPage/AdoptionsPage/Inbox-triage; stages, decline-with-reason, animal + person linkage; status emails; retire the duplicate in-app volunteer application questions (hydrate the profile from the application on account creation, matched by email). Generalize `volunteer-signup.html`'s accessible form engine into a schema-driven module and rebuild adopt/foster forms on it — fixing their broken validation wholesale.
3. **Website adoption funnel fix**: animal modal CTA → "Apply to adopt {name}" → `adopt-apply.html?animal={id}` with the animal prefilled; Adopt/Foster in primary nav; un-require the "anything else" field; single agreed volunteer path (form first, account second).
4. **Donation loop**: Zeffy webhook/CSV ingestion → `donations` collection (integer cents) + donor upsert by email; pass slider amount/frequency through to the Zeffy URL (the highest-ROI one-line fix in the stack); `/thank-you` return page firing a "Donation Completed" goal; rebuild `DonorsPage` on the donor/gift model with working thank-you (via the comms service) and gift history.
5. **Finance unification**: merge `financeStats` into `ledger`; rebuild dashboards as computed views; foreign keys to donors/grants/campaigns; persist grants (`grants` collection + store, stages, deadlines via the now-secured reminder function, LOI output saved to the record).
6. **Volunteer entity + timesheets**: canonical volunteer lifecycle keyed to uid; unify `shifts`/`checkins` into `timeEntries` with migration; versioned waivers with the guardian email flow the site already promises.
7. **Offline + field workflows**: `persistentLocalCache` + service worker; rebuild Morning Rounds as per-animal auto-saving checklist; searchable tap-grid animal picker in the feeding modal. *Makes `volunteer.html`'s offline promise true.*
8. **Brand unification** (D6): shared token layer, app re-skin, Tailwind removal, token codemod + stylelint enforcement, theme-key fix (`sb_theme`, single owner in `ui.js`).

### Phase 3 — Powerhouse features (weeks 16+)

1. **Server-rendered per-animal pages** with unique title/OG/schema, real URLs replacing `#animal-{id}` hashes; dynamic `sitemap.xml`/`robots.txt` from the DB; alt-text required at publish time (the app becomes the accessibility enforcement point for the public site).
2. **Stories/News publisher** in the app → Neon `stories` table → server-rendered `/stories/:slug` with Article schema, seeded from adoption outcomes, drafted with the existing AI bio generator. *The freshness/long-tail engine the site lacks.*
3. **Live impact stats**: replace the hardcoded `/api/stats` literals with nightly-synced real numbers (fix adopted-this-year to use outcome dates); public `/impact` page; opt-in volunteer-hours counter.
4. **Campaigns, funds, pledges** with public thermometers on donate/fundraiser pages via the proxy; **auction bidding** (bids table, current-high-bid display, outbid/winner notifications, FMV quid-pro-quo receipts); year-end giving statements (January job).
5. **Self-service shift scheduling**: capacity-based `shiftTemplates` → bookable occurrences, claim/release, certification gating, server-side generation (Cloudflare cron); recognition layer (milestones, annual letters, lapse nudges).
6. **Reports hub**: retention, LYBUNT/SYBUNT, cost per animal, funnel conversion, volunteer retention, list growth by source; CSV export; attribution stored on every inbound row. Sanctuary-appropriate outcome metrics (per-species, residents vs adoptables).
7. **Refinements**: AnimalDetail 16→6 tab consolidation with unified medical timeline; BottomNav to 5 tabs + task-first "My Day" home evolved from the Dashboard; branded document templates (grant letters, newsletters, certificates) in the Saint Francis identity; Event schema for fundraisers; public application-status page; rewrite `SEO_IMPROVEMENTS.md` and the accessibility statement as honest ledgers.

---

## 7. Accessibility & Quality Bar (Held Throughout)

- **Target WCAG 2.2 AA on both properties**, and update `accessibility.html` to say so, with a real monitored email, one `<h1>`, and the known-issues list from this review. The public conformance claim must not outrun the code.
- **Primitives-first rule**: no new feature ships using raw `<button>`, hand-rolled overlays, or unlabeled inputs. All dialogs via `AppModal`/`AppDrawer`; all status via the live-region-backed toast/announce service (add `announce()` to `ui.js`, mirroring the website's `SF.announce`).
- **Navigation must be perceivable**: on every route change set `document.title`, move focus to the page `h1` (`tabindex="-1"`), announce via live region; `aria-current` on nav; real `tablist`/`tab`/`tabpanel` + arrow keys on sub-tabs.
- **Field-use ergonomics as a hard floor**: 44×44px targets everywhere (MoreDrawer grid, checkboxes/radios ≥24px, close buttons), no text below 12px, contrast measured per token pair per theme (fix light-mint `#0FA87D`; verify the website's dark-mode block and the gold ring on light).
- **Mechanical enforcement**: `eslint-plugin-vuejs-accessibility` + axe-core smoke tests in Vitest; stylelint token rules; an Accessibility section in `NEW_FEATURE_CHECKLIST.md` (labels associated, focus visible, dialog trapped, status announced, 44px targets).
- **Honest systems**: errors surface (no swallowed catches), destructive actions never hard-delete workflow records, seeded/demo data never renders in production paths, docs (`DESIGN_SYSTEM.md`, `SEO_IMPROVEMENTS.md`, `ARCHITECTURE.md`) are corrected to match shipped reality — in this org, the docs are the design team.
- **Every message to an applicant, donor, or guardian must actually send, be logged to their record, and be written in the website's warm voice.** The brand's emotional promise is the product; the platform's job is to make it structurally keepable.