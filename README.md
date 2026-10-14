# Huilerie El Hadaji (معصرة الهداجي لزيت الزيتون) — landing page + admin

Bilingual (Arabic RTL / French LTR) landing page with cash-on-delivery ordering and an admin panel for Huilerie El Hadaji (معصرة الهداجي لزيت الزيتون), an olive oil press in Louanasda, El Kelaâ des Sraghna, Morocco. Built with TanStack Start, PostgreSQL (Drizzle) and Tailwind CSS v4.

Status: **ready for a first production deploy**: Arabic-first landing page, litre offers priced from the admin, 3-step order form (cash on delivery), ONSSA section, reviews with moderation, and the admin panel (orders, offers and prices, reviews, certificates, name, address and WhatsApp settings). See [PLAN.md](PLAN.md) for the plan and progress.

## Requirements

- Node.js 22+ (developed on 24 LTS)
- pnpm 10+
- Docker (for the local PostgreSQL), or any PostgreSQL 15+

## Setup

```bash
pnpm install
cp .env.example .env          # then edit APP_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d db       # PostgreSQL on localhost:5432 (user/pass/db: olive)
pnpm db:migrate               # apply SQL migrations from ./drizzle
pnpm db:seed                  # demo products/FAQ (flagged), draft policies, owner admin
pnpm dev                      # http://localhost:3000 → redirects to /ar or /fr
```

No Docker? Run an embedded Postgres instead (data in `.data/pglite`), in its own terminal:

```bash
pnpm db:local                 # PGlite on 127.0.0.1:5433
```

and set `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres` and `DATABASE_POOL_MAX=1` in `.env`. To preview the WhatsApp buttons before the admin panel exists, set `SEED_WHATSAPP_NUMBER` in `.env` before seeding (development only).

```bash
# then, as above
pnpm db:migrate && pnpm db:seed
```

## Set up on another PC (Windows)

One time, in PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS Git.Git     # then close and reopen PowerShell
npm install -g pnpm
git clone https://github.com/omarchaouki/zaytona.git
cd zaytona
pnpm install
copy .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # paste the result as APP_SECRET
notepad .env
```

In `.env`, set:

```ini
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres
DATABASE_POOL_MAX=1
APP_SECRET=<the long string printed above>
ADMIN_EMAIL=<your email>
ADMIN_PASSWORD=<a first password, you must change it at first login>
```

Then the database, in its own PowerShell window (leave it open):

```powershell
cd zaytona
pnpm db:local
```

And in a second window:

```powershell
cd zaytona
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000 (site) and http://localhost:3000/admin/login (admin).

Every next time: `pnpm db:local` in one window, `pnpm dev` in the other.
After `git pull`: `pnpm install` then `pnpm db:migrate`, then `pnpm dev`.

- **Bring your current data along** (orders, offers, settings, admins): stop `pnpm db:local` on the old PC, copy its `.data\pglite` folder (and `uploads\` for review photos and certificate scans) into the same place in the new `zaytona` folder, and skip `pnpm db:seed`.
- **Docker instead of `db:local`**: keep `DATABASE_URL=postgres://olive:olive@localhost:5432/olive`, run `docker compose up -d db`, then the same `db:migrate` / `db:seed` / `dev`.
- **Speed**: `pnpm dev` is slow to become clickable on a phone. To try the real speed: `pnpm build` then `pnpm start`.
- **Optional** (screenshots and the mobile audit): `pnpm exec playwright install chromium`.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server with HMR on port 3000 |
| `pnpm build` / `pnpm start` | Production build to `.output/`, then run it with Node |
| `pnpm typecheck` | TypeScript strict check (also verifies AR/FR translation key parity) |
| `pnpm lint` / `pnpm lint:fix` | Biome lint (incl. accessibility rules) and formatting |
| `pnpm test` | Vitest unit tests + migration tests on an in-process Postgres (no Docker needed) |
| `pnpm test:e2e` | Playwright end-to-end tests (from milestone 7) |
| `pnpm db:generate` | Generate a new SQL migration after editing `src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `pnpm db:seed` | Fill what is missing: default settings, demo products/FAQ (flagged `is_demo`), draft policy pages, owner admin. Never overwrites edits. |
| `pnpm admin:reset-password` | Reset the `ADMIN_EMAIL` account to `ADMIN_PASSWORD`, sign out all sessions, force a new password |
| `pnpm db:local` | Embedded Postgres (PGlite) on port 5433 for machines without Docker |
| `pnpm audit:mobile` | With the app running: checks every public page (both languages) at 320–412 px, phone landscape, 768 and 1024 px for content sticking out of the screen or out of its box, text under 12 px and tap targets under 44 px. With `AUDIT_ADMIN_EMAIL` / `AUDIT_ADMIN_PASSWORD` set, also every admin page, in Arabic and in French (the account's language is put back afterwards). `SHOTS_BASE` points it at another server (e.g. the production build). Exits non-zero on any finding. |
| `pnpm images` | Re-encode photos in `assets/source/` to responsive AVIF/WebP in `public/images/`, and regenerate the share images `og-ar.jpg` / `og-fr.jpg` |

## Environment variables

All variables are validated at boot by [src/lib/env.ts](src/lib/env.ts); the server refuses to start with a clear list of what is wrong. See [.env.example](.env.example) for the full list with comments.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `postgres://…` |
| `APP_SECRET` | yes | ≥ 32 chars; hashes IPs/phones. The example value is refused in production. |
| `SITE_URL` | prod | Public origin for canonical/hreflang/sitemap |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first run | Seed the owner account (forced password change on first login) |
| `STORAGE_DRIVER`, `UPLOAD_DIR`, `MAX_UPLOAD_MB` | no | Uploads (local disk now, S3/R2 later) |
| `SMTP_URL`, `NOTIFY_EMAIL_FROM` | no | New-order email. Sent only when both are set **and** a recipient is set in Settings → Notifications |
| `ORDER_WEBHOOK_URL` | no | New-order webhook (JSON `{ event: "order.created", order }`). A URL in Settings → Notifications takes precedence. HTTPS only in production |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | no | Optional Cloudflare Turnstile |
| `TRUST_PROXY` | prod | `true` behind your own reverse proxy, so rate limits use the real client IP |
| `DATABASE_POOL_MAX` | no | Connection pool size (use `1` with `pnpm db:local`) |
| `SEED_WHATSAPP_NUMBER` | no | Development only; refused in production |
| `ANALYTICS_*`, `UMAMI_WEBSITE_ID` | no | Optional Plausible/Umami |

## Project layout

```
src/routes        file-based routes: /, /$locale (ar|fr), later /admin
src/components    UI (ui/ = restyled shadcn primitives, landing/ = page sections)
src/i18n          ar.json, fr.json, typed t(), locale negotiation, font preloads
src/db            Drizzle schema, client, migrator, seed (+ seed-data.ts: demo content)
src/server        server-only logic (landing data, settings, rate limit, sanitising) + server functions
src/lib           env, phone, money formatting, WhatsApp links, site URLs
src/styles        Tailwind v4 entry, design tokens, fonts
drizzle/          generated SQL migrations (commit them)
assets/source/    original photos → `pnpm images`
tests/            unit + integration (Vitest)
```

## Internationalisation

- `/ar` (default, RTL) and `/fr` (LTR). `/` always redirects to `/ar` (301); visitors switch to French from the header.
- `<html lang dir>` follows the route. Use logical Tailwind utilities only (`ms-*`, `pe-*`, `start-*`…), never `ml-*`/`left-*`.
- UI strings live in `src/i18n/ar.json` and `src/i18n/fr.json`. Keys are typed: `t('hero.title')` fails to compile if the key is missing, and the build fails if the two files ever have different keys.
- Prices use Western digits in both languages with the Moroccan format (`1.250,5 درهم` / `1.250,5 MAD`).

## Admin panel

- URL: `/admin` (redirects to `/admin/login`).
- First owner: the account in `ADMIN_EMAIL` / `ADMIN_PASSWORD` (created by `pnpm db:seed`). At first login the panel asks for a new password (12+ characters); the `.env` password stops working after that.
- Forgot the password? Put a temporary one in `ADMIN_PASSWORD` and run `pnpm admin:reset-password`: it resets the account, signs out every session and asks for a new password at next login.
- **New orders**: every admin page checks every 10 s. A new order shows a red card (bottom of the screen) with a chime, a red count on « Commandes » and in the tab title; it stays red in the list until someone opens it (or « Tout marquer comme vu »). Browsers only allow sound after a first click on the page: until then the bell reads « Touchez pour activer le son ». The bell turns the chime on or off.
- **Paid**: orders are paid on delivery; « Marquer payée » on an order (or several at once from the list) records the cash. The dashboard shows the MAD received (all time and this month) and delivered orders not yet marked paid.
- **Frais de livraison / ثمن التوصيل** (Admin → Paramètres, owner): fixed fee, fixed fee free above an amount, always free, or confirmed by phone, plus an optional delivery time in Arabic and French. A preview shows the sentence customers read. The order form adds the fee to the total; orders already placed keep theirs (a single order's fee can still be changed from its page).
- **Paramètres / الإعدادات** (`/admin/settings`, owner): the WhatsApp number (empty hides every WhatsApp button) and the phone line shown for ordering by phone. Any Moroccan or international format is accepted.
- Sessions last 7 days of inactivity. Failed logins are limited (5 per email, 10 per IP, per 15 minutes) and recorded in the audit log.
- Deleting orders (owner only): the bin icon on each row / phone card, "Delete" in the bulk bar for several selected orders, or "Delete" at the top of an order page. A confirmation is always asked, and the list offers **Undo** right after. Deleted orders disappear from lists, statistics and the CSV export but stay in the database for the audit log.

## Offers and the price per litre

The shop sells olive oil only, by volume. In the panel, **Offres et prix** (`/admin/offers`, owner can edit):

- **Price per litre** (MAD). Every offer set to *automatic price* costs litres × this price and is recalculated when you save it.
- **Offers**: litres (30, 60, 90… any number), name in Arabic and French, short line of text, automatic or fixed price, visible or hidden, order. Add, edit, delete (past orders keep their lines).
- **Other quantity**: let customers type their own number of litres (min / max), priced per litre. On the site it is the last card of the offers and the last choice of the order form.

The seed starts with 30 / 60 / 90 L at a placeholder 90 MAD per litre, all marked "Exemple" until you save your own values. Upgrading an existing database: `pnpm db:migrate && pnpm db:seed` (the seed also hides the first template's untouched 1 L / 5 L / olives demo products).

## Example reviews

`pnpm db:seed` adds 4 short reviews in Darija, flagged as examples: they show an "Exemple / مثال" badge and they are never used for the hero rating, the "why us" card or Google structured data. The dashboard reminds you to delete them (Avis → delete) once real reviews arrive. `seed(db, { demoReviews: false })` skips them.

## Facebook / Instagram ads

- **Meta Pixel** (Admin → Paramètres → Marketing, owner): off by default. Turn it on and paste the Pixel ID from Meta Events Manager. The site then sends **PageView** on every page and **Lead** for every order (value in MAD, currency MAD, event ID = order reference, sent once per order even if the confirmation page is reloaded). Optional "ask the visitor first" bar: the pixel loads only after « موافق ». While the pixel is on, the privacy page automatically gains a paragraph about it. To test: Events Manager → Test events, then place a test order.
- **Where each order came from**: the `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` and `fbclid` of the visitor's first arrival (kept 30 days on the device) are saved with the order, shown as « مصدر الزيارة » on the order page and exported in the CSV. Tag your ad links, e.g. `https://your-domain.ma/ar?utm_source=facebook&utm_medium=paid&utm_campaign=30l-ramadan`.

## Order form behaviour

- **Nothing is lost on refresh**: what the visitor typed (offer, litres, name, phone, city, address, note) and the step they were on are kept on their device for 7 days (`src/lib/order-draft.ts`) and restored when the page loads again. Cleared as soon as the order is sent.
- **Offer buttons never reload the page**: every "order" button (offers, header, hero, benefits) is a plain link to `#order`; a click scrolls to the form and selects that offer (`src/lib/offer-select.ts`). They work even before the page's JavaScript has loaded.
- **Bad connection**: if sending fails, the form retries once by itself. If it fails again, the visitor sees "your details are kept", a **Retry** button and **Send by WhatsApp**, which opens WhatsApp with the whole order written out.
- In `pnpm dev` the page takes many seconds to become interactive on a phone (hundreds of unbundled modules); test speed with `pnpm build && pnpm start`.

## Spam and bots

Forms (order and review) are protected in layers, none of them visible to people:

1. **Proof of work (ALTCHA, self-hosted)**: when the form comes near the screen, the browser fetches a signed challenge and solves it in the background (about a second on a phone). The server checks the signature and accepts each solution once (`src/server/pow.ts`). A bot has to spend that CPU time for every single submission. No third-party service, no cookies, no puzzle.
2. Honeypot field and a signed render time (a submission faster than 3 s is refused).
3. Rate limits in Postgres (orders: 5 per 10 min per IP and per phone; reviews: 3 per hour per IP).
4. Optional Cloudflare Turnstile (`TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`) if spam ever gets through.

## Reviews and certificates

- Customers leave a review (stars, text, optional photo) from the Reviews section. It stays **pending** until an admin publishes it in **Admin → Reviews**; only published reviews count in the average.
- **Admin → Certificates** (owner): enter the ONSSA authorisation number (and dates) and upload a scan. The ONSSA section shows the number on its seal and a "view the authorisation" button once the scan is there; before that it offers to send a copy on WhatsApp.
- Uploaded images are re-encoded and stored in `UPLOAD_DIR` (default `./uploads`, served at `/uploads/*`). Back this folder up with the database. In production a reverse proxy can serve it directly.

## Payment

Cash on delivery only: no deposit, no bank details anywhere on the site or in the admin. (A deposit option existed in earlier versions; migration `0004_remove_deposit` dropped its columns and settings.)

## Hero video

To animate the hero arch with real footage, add a short muted clip as `assets/source/hero.mp4` (and optionally `hero.webm`), ideally 6–12 s, ≤ 4 MB, portrait or square, then run `pnpm images`. Without a video, the photos move slowly and crossfade.

## Photos

`assets/source/` currently holds two photos supplied with the brief (olive harvest close-up, oil pour). They are placeholders until the client sends their own; the oil-pour photo is only 453 px wide and must be replaced by a larger original. The list of photos to request will be in `CLIENT_HANDOVER.md` (milestone 7).

## Deployment (production)

Any Node 22+ host with PostgreSQL 15+ works (a VPS behind Caddy or nginx, or a managed Node + Postgres platform).

1. **Environment** (copy `.env.example`):
   - `SITE_URL=https://your-domain.ma` (canonical URLs, sitemap, Open Graph).
   - `DATABASE_URL` of the production database; remove `DATABASE_POOL_MAX=1` (PGlite only).
   - `APP_SECRET`: a new random value (`openssl rand -hex 32`). Never reuse the development one.
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the first owner (the password must be changed at first login).
   - Do **not** set `SEED_WHATSAPP_NUMBER` or `NODE_ENV` (the scripts set it).
   - `TRUST_PROXY=true` only behind your own reverse proxy.
2. **Build and database**:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   pnpm db:migrate
   pnpm db:seed
   ```
3. **Run**: `pnpm start` (port 3000, or `PORT=…`), kept alive by systemd, pm2 or the platform. The built server always applies production rules (Secure session cookie, real `APP_SECRET` required) even if `NODE_ENV` is not set; with a placeholder secret it refuses every page and prints `[config] … APP_SECRET` in the log. Put HTTPS and compression in front (Caddy: `encode zstd gzip`, automatic HTTPS); HSTS is sent once requests arrive over HTTPS.
4. **Before announcing the site**, in the admin:
   - Paramètres: the real WhatsApp number and phone.
   - Offres et prix: your real price per litre (the seed's 90 MAD is a placeholder) and the offers.
   - Certificats: the ONSSA number, dates and scan.
   - Avis: delete the 4 example reviews once real ones are published.
5. **Back up** the database and the `UPLOAD_DIR` folder (review photos, certificate scans) every day.

Security already on: argon2id passwords, HTTP-only session cookie, CSRF checks, rate limits, proof-of-work anti-bot on the public forms, and `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` headers on every response.
