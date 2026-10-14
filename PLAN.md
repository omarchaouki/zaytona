# PLAN — Olive cooperative landing page + admin (Kalaat Sraghna)

Source brief: [PROMPT.md](PROMPT.md). This file is the working plan; it is updated as milestones land.

## 1. Subject, audience, single job

- **Subject**: a farmers' olive cooperative in Kalaat Sraghna (Marrakech-Safi) selling its own extra virgin olive oil and olive products.
- **Audience**: Moroccan shoppers on mid-range Android phones over 4G (Arabic first), plus diaspora and French readers.
- **Single job of the public page**: turn a visit into a cash-on-delivery order (or a WhatsApp conversation that becomes one) with as little friction as possible.

## 2. Stack

| Concern | Choice |
| --- | --- |
| Framework | TanStack Start (React 19, SSR, Vite 8, Nitro server output) |
| Routing / data | TanStack Router (file-based), TanStack Query, TanStack Form + Zod, TanStack Table (admin) |
| Language | TypeScript strict (`noUncheckedIndexedAccess` on) |
| DB | PostgreSQL 16, Drizzle ORM, SQL migrations via `drizzle-kit generate` → `drizzle/` |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens), shadcn/ui (Radix) components copied in and restyled, logical utilities only (`ms-/me-/ps-/pe-/start-/end-`) |
| Validation | Zod v4, shared between client and server (`src/lib/validation`) |
| Auth | email + password, argon2id (`@node-rs/argon2`), DB sessions, HTTP-only SameSite=Lax cookie, CSRF double-submit token, login rate limit |
| Files | `StorageDriver` interface (`local` now, `s3` later), `sharp` re-encode to WebP/AVIF at 480/960/1600 px |
| Lint / format | Biome (lint + a11y rules + format) |
| Tests | Vitest (unit + integration on PGlite, an in-process Postgres), Playwright (e2e) |
| Package manager | pnpm, Node LTS (24) |

Local Postgres: `docker-compose.yml`. Integration tests and the migration check use PGlite so they run without Docker.

## 3. Folder structure

```
src/
  routes/
    __root.tsx              html shell; sets <html lang dir> from the active locale
    index.tsx               "/" → 302 to /ar or /fr from Accept-Language (fallback ar)
    $locale/
      route.tsx             validates locale (ar|fr), 404 otherwise; hreflang + canonical
      index.tsx             landing page
      privacy.tsx, terms.tsx
    admin/                  (milestone 4+) noindex, session-protected
  components/
    ui/                     shadcn primitives (restyled)
    landing/                hero, trust strip, products, …
    admin/
  server/                   server functions, auth, rate limit, storage, notifications
  db/
    schema.ts               Drizzle schema (single file, grouped by domain)
    client.ts               postgres-js + drizzle instance (server only)
    seed.ts                 demo data, clearly flagged
  i18n/
    ar.json, fr.json        UI strings (typed; key parity enforced at compile time + test)
    config.ts               locales, dir, html lang, number formatting
    index.ts                t() + useT() hook
  lib/                      env.ts (Zod), phone, money, whatsapp link builder, cn()
  styles/app.css            Tailwind v4 + design tokens + fonts
drizzle/                    generated SQL migrations
public/images/              re-encoded images (generated)
assets/source/              original photos (input for `pnpm images`)
```

## 4. Route map

| Path | Purpose |
| --- | --- |
| `/` | Redirect by `Accept-Language` (`fr*` → `/fr`, else `/ar`) |
| `/ar`, `/fr` | Landing page |
| `/{locale}/privacy`, `/{locale}/terms` | Policy pages (admin-editable rich text) |
| `/{locale}/order/{reference}` | Order confirmation (reference + WhatsApp confirm) |
| `/admin/login`, `/admin` | Dashboard |
| `/admin/orders`, `/admin/orders/{id}` | Orders table, detail, print slip |
| `/admin/products`, `/admin/reviews`, `/admin/faq`, `/admin/content`, `/admin/settings`, `/admin/admins`, `/admin/audit` | Panel pages |
| `/sitemap.xml`, `/robots.txt` | SEO (server routes) |

## 5. Database schema

Implemented in [src/db/schema.ts](src/db/schema.ts), migrations in `drizzle/`.

- `admins`, `sessions` (auth; session id is a random 256-bit token stored hashed)
- `settings` (key → jsonb) — WhatsApp number, contact, delivery rules, templates, toggles
- `products`, `product_images`, `product_lab_reports`
- `orders` (uuid id + `number` from sequence `order_number_seq` → reference `OL-YYYY-000123`), `order_items`, `order_events`
- `reviews` (status enum, rating check 1..5, `original_comment` audit, replies AR/FR)
- `faqs`, `content_blocks`, `certifications`, `gallery_images`
- `whatsapp_clicks`, `audit_logs`, `rate_limits` (fixed-window counters, Postgres-backed so it survives restarts and multiple instances)

Enums: `admin_role(owner, staff)`, `order_status(new, confirmed, shipped, delivered, cancelled, returned)`, `review_status(pending, approved, rejected)`, `stock_status(in_stock, low_stock, out_of_stock)`, `certification_type(onssa, organic, igp, iso, other)`.

## 6. Design direction

### Brief constraints (fixed)
Warm off-white ground, deep olive primary, golden oil amber accent, charcoal text. Cairo + IBM Plex Sans Arabic for Arabic; Fraunces + Inter for French. Minimal, premium, natural, no dark mode, subtle motion.

### Palette tokens

| Token | Hex | Role |
| --- | --- | --- |
| `--color-limewash` | `#F6F2E7` | page ground (warm off-white of a whitewashed wall) |
| `--color-sand` | `#ECE5D3` | secondary surface, cards on ground, dividers |
| `--color-olive` | `#2E3B1F` | primary: buttons, headings, footer ground (≈ 11:1 on limewash) |
| `--color-leaf` | `#5C6B34` | secondary text accent, icons, focus ring partner |
| `--color-oil` | `#D9A21B` | amber accent fills only (with olive or ink text on top) |
| `--color-oil-deep` | `#8A5F0C` | amber when it must be text on limewash (≥ 4.5:1) |
| `--color-ink` | `#23241F` | body text |
| `--color-ink-soft` | `#55564C` | muted text (≥ 6:1 on limewash) |

WhatsApp brand green `#25D366` (`--color-whatsapp`) is used only on WhatsApp buttons, with dark `#073B1C` (`--color-whatsapp-ink`) text and icon on top (≈ 7:1), never white on green.

### Type

- **Arabic**: Cairo 700 for headings (line-height 1.4, no tracking), IBM Plex Sans Arabic 400/500/700 for body (line-height 1.85).
- **French**: Fraunces (variable, `opsz` auto, soft) 600 for headings, Inter 400/500/600 for body (line-height 1.6).
- Heading sizes match visually across scripts by giving Arabic a slightly smaller size step (Cairo has larger x-height and taller ascenders than Fraunces).
- Fluid scale (`clamp`, 360 → 1440): `--text-display` 2.25→4.25rem, `--text-h2` 1.75→2.75rem, `--text-h3` 1.25→1.5rem, body 1rem→1.0625rem, small 0.875rem.
- Western digits in both locales, Moroccan CLDR format: `1.250,5 درهم` / `1.250,5 MAD` (`ar-MA-u-nu-latn`, `fr-MA`).

### Layout

Mobile-first single column at 360px with a 20px gutter; content max width 72rem; sections separated by space, not boxes. Desktop hero:

```
┌───────────────────────────────────────────────────────────┐
│ logo            AR | FR                      [Order now]  │
├───────────────────────────────────────────────────────────┤
│  eyebrow: Cooperative · Kalaat Sraghna     ╭───────╮       │
│  HEADLINE (2 lines)                        │ arch  │       │
│  subline                                   │ photo │       │
│  [Order now]  [WhatsApp]                   │       │       │
│                                            └───────┘       │
├─ trust strip: ONSSA · 100% natural · direct · COD · Morocco┤
```

On mobile the headline and both CTAs come first so the order button is above the fold at 360×640; the arch photo follows at ~72% width, then the trust strip as a two-column grid (a scrolling row would hide items).

### Signature: the *bab* arch

The hero photo is framed in a Moroccan horseshoe arch (the shape of a medina door or a mosque window, an SVG `clip-path`), with a thin amber line tracing the arch like light on oil. The same arch returns once, smaller, around the cooperative story photo. It is symmetric, so it reads correctly in RTL and LTR. Everything else stays quiet: no patterns, no zellige wallpaper, no gradients.

Second element (supporting, not decorative): the ONSSA badge is drawn as a round ink stamp, the visual language of Moroccan official documents, because it *is* the official-approval element. Shown only if the admin has uploaded a certificate.

### Self-critique of the plan
- First draft used a generic cream + serif + "01/02/03" numbered sections. Changed: numbers kept **only** in "How it works", which is a real sequence; nowhere else.
- First draft had zellige-pattern section dividers. Cut: decorative, adds weight, and reads as tourist-shop Morocco. The arch alone carries the place.
- Motion: one entrance (arch photo fades and the amber line draws once), nothing else animates except hover/focus states. All disabled under `prefers-reduced-motion`.

### Components
Buttons (primary olive, secondary outline, WhatsApp), section heading (eyebrow + h2), product card, trust item, stamp badge, accordion (Radix), dialog (Radix), star input, sticky mobile bar, floating WhatsApp button. Radius: 14px cards, 999px buttons. Tap targets ≥ 44px. Focus ring: 3px `--color-oil` outline with 2px offset on limewash.

## 7. Milestones

1. **Setup** — project scaffold, env validation, i18n with `/ar` RTL and `/fr` LTR, `/` redirect, hreflang/canonical, design tokens + self-hosted fonts, DB schema + migrations, docker-compose, image pipeline, Biome, Vitest. *Gate: typecheck, lint, build, tests.*
2. **Landing page (static content)** — all sections with copy in both languages, sticky header, mobile sticky bar, floating WhatsApp, settings read from DB, SEO/JSON-LD, sitemap/robots.
3. **Orders** — form (TanStack Form + Zod), Moroccan phone normalisation, city combobox, live total, anti-spam, duplicate guard, confirmation page with WhatsApp link, notifications.
4. **Admin core** — auth (argon2, sessions, CSRF, rate limit, forced password change), layout, dashboard, orders table/detail/CSV/print, polling.
5. **Admin catalogue + content** — products, images (sharp), FAQ drag reorder, content/trust/certifications, settings (WhatsApp number etc.), admins, audit log.
6. **Reviews** — public submit + list, moderation, verified badge, JSON-LD.
7. **Hardening** — security headers/CSP, analytics flag, Playwright e2e, Lighthouse pass, Dockerfile, README, CLIENT_HANDOVER.md.

## 8. Status

- [x] **Milestone 1** — scaffold, env validation, i18n (/ar RTL, /fr LTR, / redirect, hreflang, canonical, typed keys), tokens + self-hosted fonts with per-locale preload, hero + trust strip as the first sections, full DB schema + `drizzle/0000_init.sql`, docker-compose, image pipeline, Biome, Vitest (51 tests incl. migrations applied to PGlite).
  - Not yet run against a real Postgres: the Docker daemon was not running on the dev machine. `pnpm db:migrate` is the first thing to try once it is.
- [x] **Milestone 2** — every landing section (hero, trust strip, products, why-us with ONSSA stamp + certificate dialog, how it works, story + gallery, order anchor, FAQ, final CTA, footer), sticky mobile bar, floating WhatsApp with once-per-session tooltip, anonymous click counter (`/api/wa-click`), settings + content blocks read from the DB on every request, privacy/terms pages, JSON-LD (LocalBusiness, Product for non-demo products, FAQPage), sitemap.xml, robots.txt, generated OG images, idempotent seed (demo-flagged products/FAQ, draft policies, owner admin). 67 tests.
  - Local DB without Docker: `pnpm db:local` (PGlite over the Postgres protocol on :5433).
  - The order section is a WhatsApp/phone fallback until milestone 3 adds the form (`?product=` preselection already flows through).
- [x] **Milestone 3** — order form (TanStack Form + shared Zod rules): product rows with quantity steppers (preselected from `?product=`), name, Moroccan phone (any format → E.164), searchable city combobox (AR/FR, accent- and spelling-tolerant, free text allowed), optional address/note, live total from the delivery rules. Server: prices from the DB only, `OL-YYYY-000123` references from a sequence, order + items + first status event in one transaction. Anti-spam: honeypot, signed render-time token (≥ 3 s), Postgres rate limits (5 / 10 min per IP and per phone), optional Turnstile. Duplicate guard (same phone + product within 10 min) with an explicit "send anyway". Confirmation page `/{locale}/order/{reference}?t=<token>` (token required: references are sequential), noindex/no-referrer, WhatsApp button with the admin template. Optional notifications (SMTP email, webhook), never blocking the order. 90 tests.
  - Watch for M7: client JS grew to ~210 kB gzip (Zod + TanStack Form in the form chunk). If Lighthouse is under 90, lazy-load the form chunk or move the client-side rules to `zod/mini`.
- [x] **Change request (after M3)** — client feedback:
  - *Order numbers*: sequence starts at 10001 (`OL-2026-010001`); migration 0001 also moves existing databases forward, never backwards. Concurrency: `nextval()` is atomic (25 parallel orders → 25 distinct references, tested); the duplicate check now runs inside the transaction behind a per-phone advisory lock, so simultaneous double-submits create one order (tested).
  - *10% deposit by bank transfer* (replaces pure cash on delivery): `payment` settings (deposit %, bank, holder, 24-digit RIB; 0% = COD only), deposit stored per order (`deposit_amount`, `deposit_percent`, `deposit_status` pending/received/waived/not_required, received at/by, note). Form shows deposit + balance live; confirmation page shows a 3-step deposit guide with copyable RIB and a WhatsApp "send the receipt" message carrying `{deposit}`; all "pay only on delivery" copy, FAQ, terms draft, JSON-LD updated. Without a RIB in settings the page says the RIB will be sent on WhatsApp (nothing invented).
  - *Design*: bolder olive identity requested by the client, superseding the "quiet, minimal" brief: deep olive hero/why-us/story/footer with gold accents, living photos (slow Ken Burns zoom + crossfade inside the arch, glint along the arch, self-drawing olive branch), gold trust ticker, scroll reveals, parallax story band, lifted product cards with gold price tags. Real video supported: drop `assets/source/hero.mp4` (+ `.webm`) and run `pnpm images`. All motion off under `prefers-reduced-motion`; no video for reduced motion or data saver.
- [x] **Multi-step order form** (client request): 1 products → 2 contact details → 3 review & send, with a stepper, per-step validation, focus moved to each step heading, edit links on the review, server errors routed back to the right step.
- [x] **Milestone 4 — admin core**: `/admin/login` (argon2id, only failed attempts rate-limited: 5 per email / 10 per IP per 15 min, failures audited), hashed session tokens in an HTTP-only SameSite=Lax cookie (7 days, sliding), per-session CSRF token on every admin mutation + app-wide Origin/Sec-Fetch-Site check on all POSTs (`src/start.ts`), forced password change on first login (other sessions signed out), noindex headers. Dashboard (today / new / awaiting deposit with amount / delivered / total / WhatsApp clicks, 30-day chart, setup warnings, latest orders, 30 s polling with optional chime). Orders: TanStack Table, search by name / phone in any format / reference, filters (status, deposit, product, city, dates), sorting, pagination, bulk status, CSV export (UTF-8 BOM, formula-injection safe). Order page: call / WhatsApp with the template, item quantities + delivery fee edit (totals and pending deposit recomputed), deposit received / waived (owner) / reset with note, status change with timeline, internal note, printable delivery slip, soft delete (owner). Audit log on every action. `pnpm admin:reset-password` for recovery.
- [x] **Mobile polish + golden ratio + new photography** (client request): φ type scale (body 1 → lede φ^¼ → h3 √φ → h2 φ → display φ^1.5 on phones, one step up on desktop), φ line-height for French, golden spacing tokens (`g0`…`g6` = 0.382…6.854rem) and section rhythm (`section-y`: φ³ / φ⁴), 1 : φ arch, 1.618 : 1 content grids, φ : 1 product photos. New full-bleed photography (golden-hour olives in the hero, grove panorama band, grove behind the story, grove path under the final call to action) with slow motion; swipeable product row and process steps on phones; 44 px tap targets; admin orders as cards on phones; iPhone safe area. `pnpm shots` captures full-page review screenshots (Playwright).
- [x] **Milestone 6 — reviews** (pulled forward on request) + **conversion pass**: public reviews with 1–5 star picker (native radio group), optional photo (decoded and re-encoded by sharp, EXIF stripped, 5 MB max), optional phone matched to a delivered order for a "verified purchase" badge (phone stored only as a keyed hash), honeypot + signed form token + 3 per hour per IP; Amazon-style summary (average with partial stars, per-star bars that filter the list), cards with photo lightbox and cooperative replies, "load more", empty state inviting the first review; hero rating snippet and `AggregateRating`/`Review` JSON-LD from approved reviews only. Admin `/admin/reviews`: pending / published / refused tabs, search, bulk publish / refuse, refuse with internal reason, pin to top, fix typos (original kept), replies in AR and FR, owner-only delete, pending badge in the sidebar. New "why our oil and not another" section (ONSSA, origin, extraction, direct sale, payment terms, real reviews, lab reports — data-driven cards only appear with real data). Uploads: `src/server/storage.ts` (driver interface, local disk now) served by `/uploads/*`. `/admin/trust`: ONSSA and other certificates with scan upload (owner only); the public ONSSA badge appears once number + scan + "public" are set. Hook headline "من أجود زيوت المغرب" (editable; an absolute "the best" was avoided as unprovable under Law 31-08).
- [x] **Texture, photo sections, loading line, order delete, anti-bot, mobile audit** (client request):
  - *Texture*: limewash paper grain on the page (SVG fractal-noise tile with baked-in alpha, no blend modes, nothing repainted on scroll). `<SectionBackdrop>` puts a photo behind a section with a veil in three tones: `light` (watermark under limewash: products, reviews, FAQ), `dark` (deep olive + gold light: reasons, why-us, order), `photo` (photo stays visible, content on frosted cards: how to order). Contrast of the text is that of the plain ground.
  - *How to order* redesigned: golden-hour grove behind, a vertical timeline on phones (numbered beads on a gold thread, a frosted card per step with icon and a factual tag: form, deposit %, pay on delivery), three columns on a horizontal thread from tablets, gold CTA to the form.
  - *Loading line* (Livewire / NProgress style): 3 px gold line with a glowing peg at the top, 150 ms delay, trickles, runs to the end and fades; on every route change and every server-function POST (form submissions, admin saves). Grows from the reading side (right in Arabic). `src/lib/progress.ts`, `src/components/TopProgress.tsx`.
  - *Order delete*: owner-only bin per row and per phone card, bulk delete, delete at the top of the order page; confirmation sheet (bottom sheet on phones); Undo right after (restore). Still a soft delete with audit rows (`order_delete`, `order_restore`). Phone filters fold behind a "Filters" button.
  - *Anti-bot*: ALTCHA proof of work (altcha-lib v2, SHA-256, server-chosen counter 5k–60k, HMAC-signed with keys derived from `APP_SECRET`, 2 h expiry, single use through `rate_limits`), solved in the background when the form approaches the viewport; required by `placeOrder` and `submitReview` on top of the honeypot, render-time token and rate limits.
  - *Mobile*: `pnpm audit:mobile` measures overflow / text < 12 px / targets < 44 px at 320, 360, 390, 412 px and phone landscape, AR and FR: 0 findings. Fixed: final CTA wider than a 320 px screen in French, the 36 px quantity box, and the floating WhatsApp bubble that covered content on phones (phones keep WhatsApp in the sticky bar, hero and order section; the bubble stays from tablets up).
  - 121 tests (proof of work: accepted once, replay, forged, expired; orders refused without it; delete + restore).
- [x] **Litre offers, example reviews, olive texture** (client request):
  - *Catalogue*: olive oil only, sold by volume. Migration 0003 adds `products.liters` + `products.auto_price` and `reviews.is_demo`; `pricing` setting (price per litre, "other quantity" on/off with min/max, `isDemo`). Automatic offers store `liters × price per litre` in `price_mad` (recomputed on every pricing or offer save), so the page, the form and the server read one price. Custom litres become one order line (`product_id` null, unit price = price per litre, quantity = litres), validated against the limits on the server.
  - *Admin* `/admin/offers`: price per litre, other-quantity limits, offers CRUD (automatic or fixed price, visible/hidden, order), audit rows; dashboard warnings for the demo price and the example reviews.
  - *Site*: offer cards show volume, price and price per litre, plus an "other quantity" card; order step 1 is a choice of offers or a litres field with the live total.
  - *Example reviews*: 4 short Darija reviews seeded as `is_demo`, badge on each card, honest note under the summary, excluded from hero rating, the reviews reason card and JSON-LD.
  - *Design*: the panorama band ("من الشجرة إلى مائدتك") removed; the grain replaced by an olive-sprig line-art wallpaper (250 px SVG tile, alpha baked in, 13% on light grounds, 9% on dark; regenerate with a script like the one used to build `--pattern-olive-*` in app.css); loading line 1.5 px fresh olive green (`--color-progress`).
  - 126 tests.
- [x] **Production pass** (client request):
  - Arabic is the default for everyone: `/` → `/ar` (301), no Accept-Language negotiation.
  - *Deposit removed everywhere*: migration 0004 drops the `deposit_*` columns and enum, the `payment` setting (bank/RIB) and the deposit lines of the stored WhatsApp templates, FAQ answer and draft terms; the order form, confirmation page (redesigned: drawn check, reference ticket with copy, WhatsApp/phone, summary), landing copy, admin (dashboard tile → "to deliver" with cash to collect, list column/filter, detail card, packing slip, CSV) and notifications are cash-on-delivery only.
  - *ONSSA section* (`#onssa`, after "why us"): what the authorisation means (production under control, traceability under law 28-07, verifiable), and a certificate card with a round seal that is "pressed" in on scroll and slowly turns, the number/dates from Admin → Certificates, the scan in a dialog or a WhatsApp request for a copy. ONSSA is now shown as soon as a public number exists (scan optional); the trust strip and the first reason always mention it.
  - *Responsive*: no horizontal scrolling anywhere on the landing page: offers are compact horizontal cards on phones (2 columns from 640px, 4 from 1024px), the "tree to bottle" steps are a vertical timeline on phones. Admin nav is a 4-column icon grid on phones. `pnpm audit:mobile` now also checks 768×1024 and 1024×768: 0 findings in both languages.
  - *Motion everywhere*: hero entrance sequence on load; scroll reveals with stagger on every section (variants `scale`, `start` from the reading side, `fade`, `stamp`); the reveal observer also picks up content added later ("load more" reviews). All off under reduced motion.
  - *Admin → Paramètres*: WhatsApp number and order phone (owner only, audited).
  - "Exemple/مثال" badges removed from the offers; the "real customers" note under reviews is hidden while example reviews are present (they keep their badge).
  - Security headers on every response (nosniff, DENY framing, referrer policy, permissions policy, HSTS over HTTPS). README has a production checklist.
  - 113 tests (deposit tests removed with the feature).
- [x] **Live orders and payments** (client request): migration 0005 adds `orders.seen_at`, `paid_at`, `paid_by` (existing orders marked seen). Admin layout polls unseen orders every 10 s: red notification cards until opened, red badge on the Orders nav, "(n)" in the tab title, chime through one shared AudioContext unlocked on the first click/key (a context created without a user gesture stays suspended: that is why the old chime was silent). Unseen rows red with a "not opened" pill; opening an order marks it seen; "mark all as seen". Paid: per order and in bulk, audited, with timeline events; paid/unpaid/unopened filter. Dashboard: MAD received (all time, this month), delivered-but-unpaid, tiles as router links (no full reloads). Fixed a hydration mismatch (review dates formatted in the server vs browser time zone) that made React rebuild the landing page and could reset the scroll. 114 tests.
- [x] **Mobile admin + production verification** (client request):
  - Admin shell: slim top bar + bottom tab bar on phones/tablets (dashboard, orders, offers, reviews, More → certificates, settings, password, language, site, sign out in a bottom sheet); sidebar from 1024px. Notification cards sit above the tab bar.
  - Dashboard rebuilt mobile-first: one money card (collected, this month, delivered-unpaid), compact action/counter grid (new orders highlighted), setup warnings folded, chart with total, latest orders with the customer name first.
  - Orders: cards up to 1279px (2 columns from 768px), table only from 1280px; 44px targets for checkboxes, sort headers, references, status radios; reviews filter as a segmented control; full-width save buttons on phones.
  - `pnpm audit:mobile` covers admin pages (AUDIT_ADMIN_EMAIL/PASSWORD) and any server (SHOTS_BASE): 0 findings on dev and on the production build, all public and admin pages, 320–1024px.
  - Production fixes: (1) forms submitted before hydration made a native GET with the typed values in the URL (password on the login page): an inline guard blocks submits until hydration and every form is `method="post"`; (2) the built server ran with development rules when NODE_ENV was unset (`pnpm start`): non-Secure session cookie, placeholder secret accepted; env() now defaults to production in the build (import.meta.env.PROD) and logs `[config]` errors instead of failing silently.
- [x] **Ads & conversion** (client request, traffic from Facebook / Instagram ads):
  - "Benefits of olive oil" section after the offers (authorised-claim wording only: unsaturated fats replacing saturated fats, vitamin E; facts on polyphenols, cooking, Moroccan table, traditional care; general-information note), arch photo, CTA to the form.
  - Hero: price anchor ("from 2,700 MAD · 90 MAD/L", cheapest available offer) and a trust row under the button (cash on delivery, delivery everywhere, ONSSA).
  - Same photo on every offer (seed + migration 0006).
  - Meta Pixel (settings `marketing`, off by default): PageView per page, Lead per order with value/currency/eventID (deduplicated per device), optional consent bar, privacy page notice while enabled.
  - Attribution: first-touch utm_* + fbclid (30 days) stored in `orders.attribution` (migration 0006), shown on the order page and in the CSV.
  - Verified: pixel calls recorded in a browser with Meta's script stubbed (PageView ×1 per page, Lead ×1 per order, none before consent); audit 0 findings on all public and admin pages; 116 tests.
- [x] **Order form robustness + admin reviews on phones** (client request):
  - Order draft (values + step) kept in localStorage for 7 days, restored on reload, cleared once sent.
  - Offer / header order buttons are plain `#order` links that select the offer through a window event: no router navigation, no reload, work before hydration.
  - Send: one automatic retry, then a recovery box (details kept, Retry, Send by WhatsApp with the full order prefilled).
  - Admin reviews: status tabs and search on separate rows on phones, actions as a 2-column grid.
  - Audit: new "cramped field" check (text fields under 120 px); corner badges no longer count as spills.
  - Verified on the production build: 3 offer/header clicks keep the same page; refresh restores name/phone/city/offer and step 2; with the network cut, 2 attempts then the recovery box and a correct WhatsApp message; retry after reconnecting creates the order and clears the draft; audit 0 findings on public pages, admin clean except the intended badge; 116 tests.
- [x] **Admin notifications on phones + sound button** (client feedback "reviews page catastrophic"): the stacked red order cards (up to 3 + counter, ~450 px) covered the page on phones. Phones now get one slim bar (count, newest name, Open/View, close); 640 px+ shows the newest card and the counter. Closed notifications stay closed for the browser session. Sound button: icon-only bell with a pulsing dot while the browser blocks sound (was a large text pill). Admin dates pinned to Africa/Casablanca (server and browser rendered different hours). Repository on GitHub, setup steps for another PC in the README.
- [x] **French admin on phones** (client feedback): review action buttons overflowed in French (long labels in a 2-column grid squeezed beside the checkbox). Actions now span the full card width on phones with short labels ("Modifier", "تعديل ورد"; full labels from 640 px) and wrap instead of overflowing. Review tabs sized by their label; offer edit/delete icons stacked on phones. The mobile audit now also covers every admin page in French (it only checked the Arabic admin before, which is how this slipped through): 0 findings on public pages and on all admin pages in both languages, 320 px to 1024 px.
- [x] **New name and address** (client request): the business is "معصرة الهداجي لزيت الزيتون" / "Huilerie El Hadaji" (an olive press, not a cooperative), address "الوناسدة، قلعة السراغنة 43000، المغرب" / "Louanasda, El Kelaâ des Sraghna 43000, Maroc". Texts say "the press" (المعصرة / l’huilerie); cooperative-only claims (members, "brings together farmers") were removed rather than reworded into new claims. Name and address are editable in Admin → Settings (both languages). Migration 0007 updates existing databases only where the old defaults are still in place (name, empty address, WhatsApp template, privacy draft). Footer year computed in Morocco time on every render. French spellings "El Hadaji" and "Louanasda" are transliterations to confirm with the client.
- [x] **Orders: choose 10–50 per page** (client request): "per page" select (10 / 20 / 30 / 40 / 50, default 20) in the pagination bar, kept in the link (`?size=`) and remembered per device; changing it keeps the first visible order on screen; "11–20 of 63" range (always left to right); arrow-only previous/next on phones. Also fixed with 63 real orders in the audit: order cards 5 px wider than the screen in French at 320 px (grid column could not shrink), order status choices squeezed to 74 px at 1024 px (now 1–3 columns as they fit). Audit: selects may be 72 px wide; admin language switch waits for the save. 0 findings; 117 tests.
- [ ] Milestone 4 (remaining for M5): admins management page, audit log viewer. Deposit workflow details as planned: dashboard tile "awaiting deposit" (count + amount), orders table column + filter by deposit status, order detail with deposit block (amount, RIB used, "Mark deposit received" with note → `deposit_status=received`, timestamp, admin, order event; "Waive deposit" for owner), status `new → confirmed` suggested once the deposit is received, WhatsApp-the-customer template with the deposit amount, audit log entries.
- [ ] Milestones 5–7 (settings incl. WhatsApp number + RIB, products, FAQ, content; reviews; hardening)
