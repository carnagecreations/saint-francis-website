# SEO Status — Saint Francis Rescue & Sanctuary

This file previously claimed 15 shipped improvements. On review (2026-07-05), several of those claims did not match the actual code — most seriously, an `AggregateRating` schema that was never present, which would have violated Google's structured-data guidelines had it existed (rich-result eligibility requires the ratings to be real user-submitted reviews, not authored copy). This rewrite only lists what's actually in the codebase, verified by reading the files.

---

## What's actually shipped

- **NGO/AnimalShelter schema** (`index.html`) — real: name, description, address, `taxID`, `foundingDate: "2012"`, `sameAs` social links, `DonateAction`/`VolunteerAction`. No `LocalBusiness` type, no phone number, no `AggregateRating` — those were never added despite prior claims.
- **BreadcrumbList schema** on `index.html`, `animals.html`, `faq.html`, and per-animal pages (see below).
- **FAQPage schema** (`faq.html`) with real Q&A content.
- **Per-page title/meta description/canonical/OG/Twitter Card tags** on every static page — verified present and unique per page.
- **`manifest.json` and Apple web-app meta tags are still present** (`index.html:33` and others) — a prior version of this doc claimed they were removed. They were not.
- **Dynamic `sitemap.xml`** (added 2026-07-05, `_worker.js`) — previously a static, hand-maintained file; now generated per-request from the live database, listing every static page plus one entry per available/fostered/resident animal. The old static `sitemap.xml` file has been deleted since it's now shadowed by this worker route.
- **Server-rendered per-animal pages** (added 2026-07-05, `_worker.js`, route `/animal/:id-:slug`) — the single largest gap flagged in the 2026-07-04 platform review: animal listings were entirely client-rendered behind `#animal-{id}` hash routes, which are invisible to search crawlers and don't carry real OG metadata when shared. Each animal now has a real, indexable URL with a unique title, meta description, canonical link, and absolute-URL OG/Twitter image tags. The "Share" button in the animal modal (`animals.html`) now shares this real URL instead of the hash fragment.
- **Live `/api/stats`** (fixed 2026-07-05) — `currentAnimals` and `animalsAdoptedThisYear` are computed from the database (the latter now uses the real `adopted_at` date, set when an animal's status transitions to "adopted", rather than the record's creation date). `animalsRescued` is now a real total count instead of the literal `300`. `yearsActive` is now `CURRENT_YEAR - 2012` (a `FOUNDED_YEAR` constant in `_worker.js`), never a stored number that goes stale — visible page copy (`index.html`'s trust badge, `about.html`'s body text) uses the same pattern client-side via `[data-years-active]` + `app.js`, matching the existing `[data-year]` copyright-year convention. `volunteers` has no queryable source of truth, so it lives in an admin-editable `site_stats` table (`GET`/`PATCH /api/admin/site-stats`) instead of being hardcoded in source.

## Founding-year discrepancy — resolved 2026-07-05

The prior version of this doc found `index.html`'s schema disagreeing with `about.html`/the homepage on the founding year (2010 vs. ~2012). The org confirmed **2012 is correct**. Fixed everywhere: `index.html`'s `foundingDate`, `about.html`'s meta description/OG/Twitter tags and Person schema (rephrased to "since 2012" since meta tags can't be computed client-side), and `/api/stats`'s `yearsActive`.

## Not done — do not claim otherwise

- Image sitemap extensions (`<image:image>` tags) — not implemented.
- LocalBusiness schema / phone number in structured data — not implemented (the org has no public phone line to list).
- AggregateRating — not implemented, and should not be added with fabricated review data. If real reviews are ever collected (e.g. via Google Business Profile), a genuine aggregate rating could be added referencing that source.
- Analytics/Search Console monitoring cadence — this doc previously implied an active monitoring routine exists. No evidence of that was found; whoever owns Search Console access should establish one.

---

**Last verified**: 2026-07-05, against the live `_worker.js` and static HTML files, not assumed from a prior version of this document.
