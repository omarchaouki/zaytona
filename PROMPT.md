# Claude Code Prompt: Olive Cooperative Landing Page + Admin (Kalaat Sraghna, Morocco)

## 0. Role and working method

You are a senior full-stack engineer and conversion-focused product designer. Build a production-ready, bilingual (Arabic RTL + French LTR), mobile-first landing page with an order system and an admin panel for a Moroccan olive cooperative located in Kalaat Sraghna (Qalaat es-Sraghna), Morocco.

Working method:
1. Before writing code, read any available skills (use the `frontend-design` skill for visual direction, and any skills for TanStack, Postgres, Tailwind, accessibility or SEO if available). Apply them.
2. Create a short plan in a `PLAN.md` (stack, folder structure, DB schema, route map, milestones). Then implement milestone by milestone.
3. After each milestone, run typecheck, lint and build. Fix everything before moving on.
4. Never invent facts. Use clearly marked placeholders (`TODO_CLIENT`) for anything the client must supply (certificate number, phone, prices, photos, address). Never fabricate reviews, statistics, awards or certification numbers. Seed data must be obviously demo data and flagged as such in the admin.
5. At the end, produce a `README.md` (setup, env vars, seed, deploy) and a `CLIENT_HANDOVER.md` (what the client must provide and how the admin uses the panel, written in simple Darija and French).

## 1. Business context

- Client: an olive cooperative in Kalaat Sraghna (Marrakech-Safi region), selling olive products (extra virgin olive oil, table olives, possibly olive-based products like amlou or soap; the admin can edit the catalog, so do not hardcode products).
- Goal: convert visitors (mostly Moroccan mobile users, plus diaspora) into orders with the lowest friction possible.
- The cooperative holds an **ONSSA** authorization/approval (Office National de Securite Sanitaire des produits Alimentaires). The correct acronym is ONSSA. Show it as a trust badge with the real certificate number and a photo/scan of the certificate that the admin uploads. If no certificate is uploaded yet, hide the badge instead of showing a fake one.
- Payment model for v1: **cash on delivery (COD)**, orders confirmed by WhatsApp or phone call. No online payment in v1.

## 2. Tech stack (mandatory)

- **TanStack Start** (React, full-stack, SSR) with **TanStack Router** (file-based, type-safe), **TanStack Query**, **TanStack Form** (with Zod adapter), **TanStack Table** for admin tables.
- TypeScript strict mode.
- **PostgreSQL** with **Drizzle ORM** and SQL migrations (`drizzle-kit`). Provide a `docker-compose.yml` with Postgres for local dev.
- **Tailwind CSS v4** + **shadcn/ui** (Radix) components, customized, with logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) so RTL/LTR both work without hacks.
- **Zod** for all validation (shared client and server).
- Auth for admin: email + password, **argon2** hashing, secure HTTP-only, SameSite=Lax session cookies, CSRF protection on mutations, login rate limiting. Seed the first admin from env vars (`ADMIN_EMAIL`, `ADMIN_PASSWORD`), force password change on first login.
- File uploads (product images, certificate scan, gallery): store on local disk in dev and abstract behind a storage interface so it can be swapped for S3/R2. Validate MIME type and size, re-encode images with `sharp` to WebP/AVIF with responsive sizes.
- Package manager: pnpm. Node LTS.

## 3. Internationalization (Arabic + French)

- Locale-prefixed routes: `/ar/...` (default) and `/fr/...`. Root `/` redirects based on `Accept-Language`, falling back to Arabic. Language switcher visible in the header on all screens.
- `<html lang dir>` set per locale (`ar` + `rtl`, `fr` + `ltr`). Add `hreflang` alternates and canonical URLs.
- All UI strings in typed translation files (`ar.json`, `fr.json`) with a type-safe key check at build time. No hardcoded strings in components.
- Dynamic content (products, FAQ, about text, review replies) stored with both languages in the DB (`name_ar`, `name_fr`, etc.) and editable in admin. Review text itself is stored as written by the customer, with a detected language tag.
- Use Western digits (0-9) in both languages for phone numbers and prices, with currency shown as `MAD` / `درهم`. Format with `Intl.NumberFormat`.
- Write natural, persuasive Modern Standard Arabic with a warm, simple tone (not machine-translated). French copy must be written natively, not translated word for word. Provide the copy for every section in both languages.

## 4. Typography and visual design

- **Arabic fonts** (self-hosted via `@fontsource` or `next/font`-equivalent, `font-display: swap`, subset to Arabic + Latin): **Cairo** for headings and **Tajawal** or **IBM Plex Sans Arabic** for body. Make sure weights 400, 500, 700 look balanced. Line-height for Arabic body text at least 1.8, headings 1.4. No letter-spacing on Arabic text.
- **French fonts**: a refined serif for headings (e.g. Fraunces or Playfair Display) and Inter for body. Keep the heading style consistent between languages (pair Cairo with the serif visually via size and weight).
- Style: **minimalist, premium, natural**. Warm off-white background, deep olive green primary, golden olive-oil amber accent, dark charcoal text. Generous whitespace, large high-quality photography, soft rounded corners, subtle motion only (respect `prefers-reduced-motion`).
- Check color contrast (WCAG AA minimum), visible focus states, tap targets of at least 44px.
- Dark mode is not required.
- Design **mobile first** (360px baseline), then tablet and desktop. Test at 360, 390, 768, 1024, 1440.
- Avoid generic template look. Use the frontend-design skill to choose a distinct but restrained direction, and document it in `PLAN.md` (palette tokens, type scale, spacing, components).

## 5. Public landing page: sections and conversion strategy

Single long-scroll landing page per locale with sticky header (logo, language switch, "Order now" button). Order of sections:

1. **Hero**: strong headline (benefit-driven, e.g. pure olive oil from the heart of Kalaat Sraghna), one-line subheadline, primary CTA "Order now" (scrolls to order form), secondary CTA "WhatsApp", hero image/video of olive groves and bottles. Immediately under the hero, a **trust strip**: ONSSA authorized, 100% natural, direct from the cooperative, cash on delivery, delivery across Morocco.
2. **Products**: cards with photo, name, size, price (MAD), short benefit line, and an "Order" button that preselects the product in the form. Products come from DB (active ones only), with out-of-stock state.
3. **Why us / Trust section** (all trust elements, see section 6).
4. **How it works**: 3 steps (choose, confirm by WhatsApp/phone, receive and pay at delivery).
5. **Our story and the cooperative**: short story, the region, members, harvest and pressing process, photo gallery.
6. **Reviews**: approved reviews only, average rating, rating distribution, "Write a review" button (see section 8).
7. **Order form** (see section 7).
8. **FAQ**: accordion, 8 to 12 questions in both languages (delivery times and cities, cash on delivery, return and refund policy, storage and shelf life, acidity level and how it is measured, what ONSSA authorization means, minimum order, bulk and gift orders, how to track the order, contact hours). Admin-editable. Add `FAQPage` JSON-LD.
9. **Final CTA** band with WhatsApp and order buttons.
10. **Footer**: cooperative name, address (TODO_CLIENT), map link (embedded map only on click to keep performance), phone, WhatsApp, opening hours, social links, language switch, legal links (privacy policy, terms and sale conditions), ONSSA number.

Conversion rules:
- One primary action per screen. Repeat the order CTA after products, reviews and FAQ.
- Sticky bottom bar on mobile with "Order" + WhatsApp.
- No pop-ups, no auto-playing audio, no newsletter wall.
- Fast: target Lighthouse mobile at least 90 for Performance, 100 for Accessibility, SEO and Best Practices. LCP under 2.5s on 4G. Lazy-load below-the-fold images, preload hero image and fonts, no layout shift.

## 6. Trust elements (include all, each editable in admin where relevant)

- ONSSA badge with certificate number, issue date, and a clickable modal showing the uploaded certificate scan. Add short explanatory text about what ONSSA authorization means (do not overclaim; keep it factual).
- Other certifications or labels only if the admin adds them (organic, IGP, ISO, etc.), shown as optional badges.
- Cooperative identity: legal name, ICE / RC numbers if the client wants to display them (optional fields in settings), real address, real phone numbers, real photos of the team and site.
- Lab analysis: optional upload of an analysis report (acidity, peroxide) shown as "Quality report" per product when provided.
- Customer reviews with real count and average (computed from approved reviews only), marked with "verified order" when the review is linked to a delivered order phone number match (optional, see schema).
- Policies in plain language: cash on delivery, delivery time and fee, return/refund, privacy. Short versions on the page, full pages linked.
- Security cues: no payment data collected in v1, say so near the form ("Pay only when you receive your order").
- Social proof counters only if backed by real data from the DB (e.g. delivered orders count). Otherwise hide them.
- Contact transparency: WhatsApp, phone, working hours, response time promise.

## 7. Order form (minimum friction)

Fields only (4 required, 2 optional):
- Full name (required)
- Phone number (required, Moroccan format validation: `+212` or `0` followed by 5/6/7 and 8 digits, normalize to `+212XXXXXXXXX`)
- City (required, searchable select of Moroccan cities, with free text fallback)
- Product + quantity (required, preselected from the product card, quantity stepper)
- Address / neighborhood (optional, textarea)
- Note (optional)

Behavior:
- Single-step form, inline validation messages in the active language, large inputs, correct `inputmode` and `autocomplete` attributes, phone keypad on mobile.
- Show live total (items + delivery fee from settings, or "delivery fee confirmed by phone").
- Anti-spam: honeypot field, server-side rate limit per IP and per phone, minimum time-to-submit check. No CAPTCHA wall in v1 (optional Cloudflare Turnstile behind an env flag).
- On success: confirmation screen with order reference (e.g. `OL-2026-000123`), summary, and a prefilled **WhatsApp button** ("Confirm my order on WhatsApp") that opens `wa.me/<number>?text=<encoded order summary>` in the active language.
- Store the order even if the user never opens WhatsApp.
- Duplicate protection: same phone + same product within 10 minutes shows a friendly warning instead of creating duplicates.
- Optional admin notification: email (SMTP env) and/or webhook on new order, behind env flags.

## 8. Reviews system with moderation

Public:
- List of approved reviews (name or initials, city optional, rating 1 to 5, comment, date, "verified" badge if applicable), with pagination or "load more".
- "Write a review" form: name (required), rating (required, accessible star input with keyboard support), comment (required, 10 to 600 chars), city (optional), phone (optional, never displayed, used only to match a delivered order for the verified badge), honeypot + rate limit. Optional photo upload behind a flag.
- After submit: message "Thank you, your review will appear after approval". Review status is `pending`.
- Structured data: `AggregateRating` and `Review` JSON-LD only from approved real reviews.

Admin:
- Reviews table with filters (pending, approved, rejected), search, and bulk actions.
- Actions: approve, reject (with optional internal reason), delete, edit text for typos (keep original in an audit field), reply publicly (reply text in AR and FR, optional), feature on top.
- Pending count badge in the admin sidebar.

## 9. Admin panel (`/admin`, not indexed, noindex header, protected by session)

UI language: Arabic and French toggle (default Arabic), mobile-friendly (the admin will often use a phone). Pages:

1. **Dashboard**: new orders today, pending orders, total orders, pending reviews, simple chart of orders over 30 days, quick links.
2. **Orders**: TanStack Table with search (name, phone, reference), filters (status, date range, city, product), sorting, pagination, bulk status change, **CSV export**. Order detail drawer or page with customer info, items, totals, timeline of status changes, internal notes, buttons: call, WhatsApp the customer (prefilled message template in customer's language), print label/packing slip (print CSS). Statuses: `new`, `confirmed`, `shipped`, `delivered`, `cancelled`, `returned`. Admin can edit order items, quantity, delivery fee and delete (soft delete) an order. New-order indicator updates via polling (TanStack Query refetch interval) with an optional sound toggle.
3. **Products**: create, edit, reorder, activate/deactivate, stock flag, price, size, images (multiple), AR and FR name and description, SEO fields.
4. **Reviews**: as in section 8.
5. **FAQ**: CRUD with AR/FR fields and drag-to-reorder.
6. **Content and trust**: editable hero texts, about/story text, gallery images, certification badges (ONSSA number, issue date, certificate image upload), lab reports, testimonials of the cooperative, policies pages (rich text, AR/FR).
7. **Settings**:
   - **WhatsApp number** (international format with validation and a "Test link" button). This value drives **all** WhatsApp buttons across the site (floating button, hero, final CTA, footer, order confirmation, sticky mobile bar). Changing it applies immediately, no redeploy.
   - Phone number(s), email, address, map link, opening hours, social links.
   - Delivery fee rules (flat fee, free above threshold, or "to be confirmed").
   - Default WhatsApp message templates in AR and FR (with placeholders like `{name}`, `{reference}`, `{items}`, `{total}`).
   - Notification settings (email recipient, webhook URL).
   - Show/hide toggles for optional sections (reviews, gallery, counters).
8. **Admins**: add/remove admin users, change own password. Roles: `owner` and `staff` (staff cannot change settings or delete data).
9. **Audit log** for important actions (login, status changes, review moderation, settings changes).

Admin can see and control everything stored: orders, customers, reviews, products, FAQ, content, settings.

## 10. Floating WhatsApp contact (web and mobile)

- Fixed circular WhatsApp icon (use official brand green, accessible name and `aria-label` per locale), bottom corner: bottom-end on web (right in LTR, left in RTL), above the sticky bottom bar on mobile so they never overlap. Respect safe-area insets on iOS.
- Subtle entrance animation, no constant pulsing (respect reduced motion). Optional small tooltip "Need help? Chat with us" shown once per session.
- Link: `https://wa.me/<number from settings>?text=<localized greeting>`. If no number is configured, hide the button and show a warning in the admin dashboard.
- Track clicks (anonymous counter in DB, shown in admin dashboard) to measure effectiveness.

## 11. Database (PostgreSQL) schema outline

Use Drizzle schema files and generate migrations. Use `uuid` PKs (or `bigint` identity for order numbers with a human-readable reference), `timestamptz` timestamps, proper indexes and constraints.

- `admins` (id, email unique, password_hash, role, must_change_password, created_at, last_login_at)
- `sessions` (id, admin_id, expires_at, ip, user_agent)
- `settings` (key text primary key, value jsonb, updated_at) for whatsapp number, contact info, delivery rules, templates, toggles
- `products` (id, slug, name_ar, name_fr, description_ar, description_fr, price_mad numeric(10,2), size_label, stock_status, is_active, sort_order, seo fields, created_at)
- `product_images` (id, product_id, url, alt_ar, alt_fr, sort_order)
- `orders` (id, reference unique, customer_name, phone_e164, city, address, note, status enum, delivery_fee, total, locale, source, ip_hash, user_agent, created_at, updated_at, deleted_at)
- `order_items` (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity)
- `order_events` (id, order_id, admin_id nullable, from_status, to_status, note, created_at)
- `reviews` (id, author_name, city, rating smallint check 1..5, comment, language, phone_hash nullable, order_id nullable, status enum pending/approved/rejected, is_featured, reply_ar, reply_fr, rejection_reason, original_comment, created_at, moderated_at, moderated_by)
- `faqs` (id, question_ar, question_fr, answer_ar, answer_fr, sort_order, is_active)
- `content_blocks` (key, value_ar jsonb, value_fr jsonb) for editable page texts
- `certifications` (id, type, number, issued_at, expires_at nullable, image_url, is_public)
- `gallery_images` (id, url, caption_ar, caption_fr, sort_order)
- `whatsapp_clicks` (id, placement, locale, created_at)
- `audit_logs` (id, admin_id, action, entity, entity_id, meta jsonb, created_at)

Provide a `seed` script with clearly labeled demo products and FAQ in both languages (replaceable by the client), plus the owner admin from env.

Privacy: store phone numbers only as needed for orders, hash IPs, and add a privacy policy page that matches Moroccan data protection law (Law 09-08, CNDP) in plain language, flagged for the client to review with a lawyer.

## 12. Security and quality

- Validate every input server-side with Zod, parameterized queries only (Drizzle), output escaping (React default) and sanitize any rich text (DOMPurify or a server sanitizer).
- Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), secure cookies, CSRF on mutations, rate limiting on public POST endpoints and login.
- Environment variables validated at boot (`env.ts` with Zod). No secrets in the repo; provide `.env.example`.
- Tests: Vitest unit tests for validators (phone, order totals, review rules), integration tests for order creation and review moderation, and a few Playwright e2e tests (order flow in AR and FR on a mobile viewport, admin login and order status change, review submit then approve, WhatsApp number change reflected on the site).
- Accessibility: semantic HTML, labels, ARIA only when needed, keyboard navigation, screen reader tested accordion and star rating, correct focus management in dialogs and drawers.
- SEO: unique titles and meta descriptions per locale, Open Graph and Twitter cards with a generated share image, `sitemap.xml`, `robots.txt` (disallow `/admin`), JSON-LD for `LocalBusiness` (or `Organization`), `Product`, `FAQPage`, `AggregateRating` (real data only).
- Analytics: privacy-friendly, optional (Plausible/Umami via env flag). Include basic event tracking for CTA clicks, order submit and WhatsApp click.

## 13. Deliverables and structure

- Clean monorepo-free single app structure (`src/routes`, `src/components`, `src/server`, `src/db`, `src/i18n`, `src/lib`, `src/styles`).
- `docker-compose.yml` (Postgres), `Dockerfile` for production, and deployment notes for a VPS (Node + Postgres + reverse proxy with HTTPS) and for a managed option.
- Scripts: `dev`, `build`, `start`, `db:generate`, `db:migrate`, `db:seed`, `test`, `test:e2e`, `lint`, `typecheck`.
- Placeholder images from a neutral source must be replaced by real client photos; document exactly which photos to request (hero grove, press/mill, bottles, team, certificate scan).

## 14. Acceptance checklist (verify before finishing)

- [ ] Landing page works in `/ar` (RTL) and `/fr` (LTR) with no layout bugs at 360px width.
- [ ] Arabic text uses Cairo/Tajawal (or IBM Plex Sans Arabic), no fallback fonts visible, correct line-height.
- [ ] Order form has only the minimal fields, validates Moroccan phones, saves to Postgres, shows reference and WhatsApp confirm button.
- [ ] Admin can log in, see new orders, change status, search, filter, export CSV, edit and soft delete.
- [ ] Admin can set the WhatsApp number in Settings and every WhatsApp button (floating on web and mobile, sticky bar, hero, footer, confirmation) updates immediately.
- [ ] Floating WhatsApp icon is fixed on web and mobile and never overlaps other controls in RTL or LTR.
- [ ] Reviews: visitor can submit, it stays pending, admin can approve or reject, only approved appear publicly, aggregate rating computed from approved only.
- [ ] ONSSA badge and certificate modal driven by admin-uploaded data, hidden if not provided.
- [ ] FAQ editable in admin, AR and FR, with JSON-LD.
- [ ] Lighthouse mobile: Performance at least 90, Accessibility, Best Practices and SEO at least 95.
- [ ] No fabricated claims, numbers, reviews or certificates anywhere in the shipped content.
- [ ] README, `.env.example`, seed, tests and `CLIENT_HANDOVER.md` (Darija and French) are complete.

Start now: read the available skills, write `PLAN.md`, then scaffold the TanStack Start project and implement milestone 1 (project setup, i18n with RTL/LTR, design tokens and fonts, DB schema and migrations).
