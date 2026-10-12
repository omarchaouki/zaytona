import { PGlite } from '@electric-sql/pglite'
import { count, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '~/db/client'
import * as schema from '~/db/schema'
import { seed } from '~/db/seed-run'
import { landingJsonLd } from '~/lib/jsonld'
import { loadChrome } from '~/server/chrome'
import { loadLanding } from '~/server/landing'

const pg = new PGlite()
const db = drizzle(pg, { schema }) as unknown as Database

beforeAll(async () => {
  await migrate(drizzle(pg), { migrationsFolder: './drizzle' })
  await seed(db, { adminEmail: 'owner@example.com', adminPassword: 'a-long-test-password' })
})

afterAll(async () => {
  await pg.close()
})

describe('seed', () => {
  it('is idempotent and flags demo rows', async () => {
    await seed(db, { adminEmail: 'owner@example.com', adminPassword: 'a-long-test-password' })
    const [p] = await db.select({ n: count() }).from(schema.products)
    const [f] = await db.select({ n: count() }).from(schema.faqs)
    const [a] = await db.select({ n: count() }).from(schema.admins)
    expect(p?.n).toBe(3)
    expect(f?.n).toBe(10)
    expect(a?.n).toBe(1)
    const demo = await db.select().from(schema.products).where(eq(schema.products.isDemo, false))
    expect(demo).toEqual([])
  })

  it('creates the owner with a forced password change and an argon2id hash', async () => {
    const [owner] = await db.select().from(schema.admins)
    expect(owner?.role).toBe('owner')
    expect(owner?.mustChangePassword).toBe(true)
    expect(owner?.passwordHash).toMatch(/^\$argon2id\$/)
  })

  it('leaves the WhatsApp number unset by default', async () => {
    const chrome = await loadChrome(db, 'ar')
    expect(chrome.whatsappNumber).toBeNull()
  })
})

describe('loadLanding', () => {
  it('returns localised active products with images', async () => {
    const fr = await loadLanding(db, 'fr')
    expect(fr.products.map((p) => p.sizeLabel)).toEqual(['30 litres', '60 litres', '90 litres'])
    expect(fr.products.map((p) => [p.liters, p.price])).toEqual([
      [30, '2700.00'],
      [60, '5400.00'],
      [90, '8100.00'],
    ])
    expect(fr.products.every((p) => p.isDemo && p.image)).toBe(true)
    expect(fr.settings.pricing).toEqual({
      pricePerLiter: 90,
      isDemo: true,
      custom: { min: 5, max: 500 },
    })
    const ar = await loadLanding(db, 'ar')
    expect(ar.products[0]?.name).toBe('زيت الزيتون البكر الممتاز')
  })

  it('hides inactive products', async () => {
    await db
      .update(schema.products)
      .set({ isActive: false })
      .where(eq(schema.products.slug, 'huile-olive-90l'))
    const data = await loadLanding(db, 'fr')
    expect(data.products).toHaveLength(2)
  })

  it('shows the public ONSSA authorisation once its number is entered, scan optional', async () => {
    expect((await loadLanding(db, 'ar')).onssa).toBeNull()
    const [cert] = await db
      .insert(schema.certifications)
      .values({ type: 'onssa', number: 'TEST-123', isPublic: true })
      .returning()
    const data = await loadLanding(db, 'ar')
    expect(data.onssa).toMatchObject({ number: 'TEST-123', image: null })

    await db
      .update(schema.certifications)
      .set({ imageUrl: 'static:olives-harvest' })
      .where(eq(schema.certifications.id, cert?.id ?? ''))
    expect((await loadLanding(db, 'ar')).onssa?.image).not.toBeNull()

    await db
      .update(schema.certifications)
      .set({ isPublic: false })
      .where(eq(schema.certifications.id, cert?.id ?? ''))
    expect((await loadLanding(db, 'ar')).onssa).toBeNull()
  })

  it('only shows the delivered counter when enabled and non-zero', async () => {
    expect((await loadLanding(db, 'fr')).stats.deliveredOrders).toBeNull()
    await db
      .update(schema.settings)
      .set({ value: { showReviews: true, showGallery: true, showCounters: true } })
      .where(eq(schema.settings.key, 'toggles'))
    expect((await loadLanding(db, 'fr')).stats.deliveredOrders).toBeNull()
    await db.insert(schema.orders).values({
      reference: 'OL-TEST-1',
      customerName: 'Test',
      phoneE164: '+212612345678',
      city: 'Marrakech',
      subtotal: '90',
      total: '90',
      locale: 'fr',
      status: 'delivered',
    })
    expect((await loadLanding(db, 'fr')).stats.deliveredOrders).toBe(1)
  })

  it('sanitises FAQ answers into paragraphs', async () => {
    const data = await loadLanding(db, 'fr')
    expect(data.faqs).toHaveLength(10)
    expect(data.faqs[0]?.answer.startsWith('<p>')).toBe(true)
  })

  it('builds JSON-LD without demo products', async () => {
    const data = await loadLanding(db, 'fr')
    const chrome = await loadChrome(db, 'fr')
    const ld = landingJsonLd({ origin: 'https://example.ma', locale: 'fr', chrome, data })
    expect(ld.map((x) => x['@type'])).toEqual(['LocalBusiness', 'FAQPage'])

    await db.update(schema.products).set({ isDemo: false })
    const real = await loadLanding(db, 'fr')
    const ld2 = landingJsonLd({ origin: 'https://example.ma', locale: 'fr', chrome, data: real })
    const product = ld2.find((x) => x['@type'] === 'Product') as
      | { offers: { price: string; priceCurrency: string } }
      | undefined
    expect(product?.offers).toMatchObject({ price: '2700.00', priceCurrency: 'MAD' })
  })

  it('shows the example reviews with a badge, but never as ratings', async () => {
    const data = await loadLanding(db, 'ar')
    expect(data.reviews?.summary.count).toBe(4)
    expect(data.reviews?.items.every((r) => r.isDemo)).toBe(true)
    expect(data.reviews?.realSummary.count).toBe(0)
    const chrome = await loadChrome(db, 'ar')
    const ld = landingJsonLd({ origin: 'https://example.ma', locale: 'ar', chrome, data })
    const business = ld.find((x) => x['@type'] === 'LocalBusiness') as Record<string, unknown>
    expect(business.aggregateRating).toBeUndefined()
    expect(business.review).toBeUndefined()
  })
})
