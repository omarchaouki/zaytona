import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { defaultSettings, type SettingsKey } from '~/lib/settings'
import { normalizeWhatsappNumber } from '~/lib/whatsapp'
import { hashPassword } from '~/server/auth/password'
import type { Database } from './client'
import { admins, contentBlocks, faqs, productImages, products, reviews, settings } from './schema'
import {
  DEMO_PRICE_PER_LITER,
  demoFaqs,
  demoProducts,
  demoReviews,
  legacyDemoSlugs,
  privacyDraft,
  termsDraft,
} from './seed-data'

export type SeedOptions = {
  adminEmail?: string
  adminPassword?: string
  /** Development only: preview WhatsApp buttons. */
  whatsappNumber?: string
  /** Example reviews (flagged is_demo); on unless set to false. */
  demoReviews?: boolean
  log?: (message: string) => void
}

/** Idempotent: only fills what is missing, never overwrites the client's edits. */
export async function seed(db: Database, opts: SeedOptions = {}) {
  const log = opts.log ?? (() => {})

  // Settings: write defaults for keys that do not exist yet.
  const defaults = defaultSettings()
  defaults.pricing = { ...defaults.pricing, pricePerLiter: DEMO_PRICE_PER_LITER, isDemo: true }
  if (opts.whatsappNumber) {
    const number = normalizeWhatsappNumber(opts.whatsappNumber)
    if (!number) throw new Error('SEED_WHATSAPP_NUMBER is not a valid phone number')
    defaults.whatsapp = { number }
  }
  for (const key of Object.keys(defaults) as SettingsKey[]) {
    const inserted = await db
      .insert(settings)
      .values({ key, value: defaults[key] })
      .onConflictDoNothing()
      .returning({ key: settings.key })
    if (inserted.length) log(`settings.${key}: defaults written`)
  }

  // Demo offers (by slug), priced from the price per litre.
  const [pricingRow] = await db.select().from(settings).where(eq(settings.key, 'pricing'))
  const pricePerLiter =
    (pricingRow?.value as { pricePerLiter?: number | null } | undefined)?.pricePerLiter ??
    DEMO_PRICE_PER_LITER
  for (const [i, p] of demoProducts.entries()) {
    const [row] = await db
      .insert(products)
      .values({
        slug: p.slug,
        nameAr: p.nameAr,
        nameFr: p.nameFr,
        taglineAr: p.taglineAr,
        taglineFr: p.taglineFr,
        sizeLabelAr: p.sizeLabelAr,
        sizeLabelFr: p.sizeLabelFr,
        liters: String(p.liters),
        autoPrice: true,
        priceMad: (p.liters * pricePerLiter).toFixed(2),
        sortOrder: i,
        isDemo: true,
      })
      .onConflictDoNothing({ target: products.slug })
      .returning({ id: products.id })
    if (row) {
      await db
        .insert(productImages)
        .values({ productId: row.id, url: p.image, altAr: p.altAr, altFr: p.altFr })
      log(`product ${p.slug}: demo row created`)
    }
  }
  // The first template's demo products (1 L, 5 L, olives) go offline unless the admin kept them.
  const retired = await db
    .update(products)
    .set({ isActive: false })
    .where(
      and(
        inArray(products.slug, legacyDemoSlugs),
        eq(products.isDemo, true),
        eq(products.isActive, true),
      ),
    )
    .returning({ slug: products.slug })
  for (const r of retired) log(`product ${r.slug}: old demo product hidden`)

  // Example reviews, once (they are recognisable by is_demo and can be deleted).
  if (opts.demoReviews !== false) {
    const [{ n: demoCount } = { n: 0 }] = await db
      .select({ n: count() })
      .from(reviews)
      .where(eq(reviews.isDemo, true))
    if (demoCount === 0) {
      await db.insert(reviews).values(
        demoReviews.map((r, i) => ({
          ...r,
          language: 'ar',
          status: 'approved' as const,
          isDemo: true,
          moderatedAt: new Date(),
          createdAt: new Date(Date.now() - (i + 1) * 86_400_000),
        })),
      )
      log(`reviews: ${demoReviews.length} example reviews created`)
    }
  }

  // Demo FAQ, only on an empty table.
  const [{ n: faqCount } = { n: 0 }] = await db.select({ n: count() }).from(faqs)
  if (faqCount === 0) {
    await db.insert(faqs).values(
      demoFaqs.map((f, i) => ({
        questionAr: f.qAr,
        answerAr: f.aAr,
        questionFr: f.qFr,
        answerFr: f.aFr,
        sortOrder: i,
        isDemo: true,
      })),
    )
    log(`faq: ${demoFaqs.length} demo questions created`)
  }

  // Policy page drafts.
  for (const [key, draft] of [
    ['page_privacy', privacyDraft],
    ['page_terms', termsDraft],
  ] as const) {
    const inserted = await db
      .insert(contentBlocks)
      .values({ key, valueAr: draft.ar, valueFr: draft.fr })
      .onConflictDoNothing()
      .returning({ key: contentBlocks.key })
    if (inserted.length) log(`${key}: draft written (needs legal review)`)
  }

  // Owner account.
  if (opts.adminEmail && opts.adminPassword) {
    const existing = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(sql`lower(${admins.email})`, opts.adminEmail.toLowerCase()))
    if (existing.length === 0) {
      await db.insert(admins).values({
        email: opts.adminEmail,
        passwordHash: await hashPassword(opts.adminPassword),
        role: 'owner',
        mustChangePassword: true,
      })
      log(`admin ${opts.adminEmail}: owner created (password change required at first login)`)
    }
  } else {
    log('admin: ADMIN_EMAIL / ADMIN_PASSWORD not set, no owner created')
  }
}
