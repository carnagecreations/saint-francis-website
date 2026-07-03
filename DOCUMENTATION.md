# Saint Francis Website — Documentation

## Overview
Public-facing website for Saint Francis Rescue & Sanctuary. Vanilla HTML/CSS/JS (no build step), deployed to Cloudflare Pages with a bundled Worker (`_worker.js`, Hono) serving the API.

**Live URL:** https://sfr-rescue.pages.dev
**Source:** `C:\Users\lawye\Projects\SaintFrancis-Website`
**Companion app:** SanctuaryBase (`C:\Users\lawye\Projects\SB- v2` → https://sanctuarybase.pages.dev) manages animals, auction items, and the contact inbox through this site's admin API.

---

## Architecture

- **Frontend:** static HTML pages + shared `styles.css` + shared `app.js` (API client `window.SF` + shared behaviors). No framework, no build.
- **Backend:** `_worker.js` — bundled Hono app. Hand-written routes start around line 14600 (everything above is bundled framework/Drizzle code — don't edit it).
- **Database:** Neon PostgreSQL via Drizzle ORM (`NEON_DATABASE_URL`). Tables: `animals`, `contacts`, `auction_items`, `suggestions`.
- **Images:** Cloudflare R2 bucket `sfr-rescue-media` (binding `MEDIA`), served by the worker at `/media/{key}` with 1-year immutable caching.
- **Donations:** Zeffy (external — no payment data touches this site).

## API Routes (all under `/api`)

### Public
| Method | Route | Purpose |
|---|---|---|
| GET | `/healthz` | Health check |
| GET | `/animals` | List animals (`?status=`, `?species=` filters) |
| GET | `/animals/featured` | Featured animals |
| GET | `/animals/:id` | Single animal |
| GET | `/stats` | Aggregate homepage stats |
| POST | `/contact` | Contact/application form submissions |
| GET | `/fundraiser/items` | Auction items (`?status=` filter) |
| GET | `/fundraiser/items/:id` | Single auction item |
| POST/GET | `/suggestions`, PATCH `/suggestions/:id/vote` | Name-suggestion feature (names.html) |

### Admin (Bearer `ADMIN_TOKEN`)
| Method | Route | Purpose |
|---|---|---|
| POST | `/admin/login` | Exchange password for token |
| POST | `/admin/uploads` | Multipart image upload to R2 (`files` field) → `{ urls: [] }` |
| GET/POST | `/admin/animals`, PATCH/DELETE `/admin/animals/:id` | Animal CRUD |
| GET/POST | `/admin/auction-items`, PATCH/DELETE `/admin/auction-items/:id` | Auction CRUD |
| GET | `/contacts`, PATCH/DELETE `/contacts/:id` | Contact inbox (list, reply/archive, delete) |

**Consumer of the admin API:** SanctuaryBase only, via its Pages Function proxy `functions/api/site/[[path]].js`, which verifies Firebase login + Firestore role, then forwards with the `SITE_ADMIN_TOKEN` Pages secret. **If you rotate ADMIN_TOKEN here, update the `SITE_ADMIN_TOKEN` secret on the sanctuarybase Pages project too.**

> `admin.html` on this site is retired — it's now just a redirect stub to SanctuaryBase. All animals, auction items, and inbox management happens in the app. (The `/admin/login` worker route is vestigial but harmless.)

> Note: there is no email-sending, ad-copy, or grant-writer endpoint on this site. "Replies" from the inbox are stored in the database (`reply` column), not emailed. AI bio generation lives in SanctuaryBase (Workers AI binding there).

## Configuration

- `wrangler.toml` — project name `sfr-rescue`, output dir `.`, R2 binding, `NEON_DATABASE_URL` under `[env.production]`.
- `ADMIN_TOKEN` — set as a Pages environment variable/secret in the Cloudflare dashboard (Settings → Environment variables → Production). Not stored in this repo.
- `_headers` — security headers (CSP, HSTS, etc.) and cache rules (images/fonts 1y immutable, css/js 1w, admin/api no-store).

**Rotating ADMIN_TOKEN:**
1. Generate: `openssl rand -hex 12`
2. Update the Pages env var for `sfr-rescue` (dashboard) and redeploy.
3. Update the `SITE_ADMIN_TOKEN` secret on the `sanctuarybase` Pages project and redeploy it.

## Deployment

```bash
cd C:\Users\lawye\Projects\SaintFrancis-Website
wrangler pages deploy . --project-name=sfr-rescue
```

Deploys all HTML, `styles.css`, `app.js` (cache-busted via `?v=` query in script/link tags — bump when editing), `_worker.js`, `_headers`, `images/`, `fonts/`.

## Troubleshooting

- **API 404:** route paths in `_worker.js` must NOT include `/api/` (basePath adds it).
- **Images broken:** verify R2 bucket `sfr-rescue-media` and the `MEDIA` binding; image URLs are site-relative `/media/animals/...`.
- **Contact submissions missing in SanctuaryBase inbox:** check Neon (https://console.neon.tech), `NEON_DATABASE_URL`, then the SanctuaryBase proxy (Firebase auth + `SITE_ADMIN_TOKEN`).
- **SanctuaryBase can't manage animals/auction/inbox:** `ADMIN_TOKEN` env var missing on this Pages project, or `SITE_ADMIN_TOKEN` secret out of sync on the sanctuarybase project.
- **Worker logs:** `wrangler pages deployment tail --project-name=sfr-rescue`

## Maintenance

- Monthly: test contact form, Zeffy link, and an admin login.
- Annually: rotate `ADMIN_TOKEN` (both projects), review CSP if new external services are added.

Last updated: 2026-07-03
