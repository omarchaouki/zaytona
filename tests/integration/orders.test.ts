import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '~/db/client'
import * as schema from '~/db/schema'
import { seed } from '~/db/seed-run'
import { describeAttribution } from '~/lib/attribution'
import { deliveryFromChoice } from '~/lib/settings'
import { issueFormToken } from '~/server/form-token'
import { getOrderConfirmation, orderViewToken, placeOrder } from '~/server/orders'
import { addTestProducts } from './fixtures'

const pg = new PGlite()
const db = drizzle(pg, { schema }) as unknown as Database
let oil1l = ''
let oil5l = ''
let olives = ''
let ipCounter = 0

const T0 = new Date('2026-10-09T10:00:00Z')

function input(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Amina El Idrissi',
    phone: '06 12 34 56 78',
    city: 'Marrakech',
    address: '',
    note: '',
    items: [{ productId: oil1l, quantity: 2 }],
    locale: 'fr',
    formToken: issueFormToken(T0.getTime() - 10_000),
    website: '',
    ...overrides,
  }
}

/** Fresh IP per call unless a test pins one, so the per-IP limit stays out of the way. */
const ctx = (overrides: Partial<Parameters<typeof placeOrder>[2]> = {}) => ({
  ipHash: `ip-${++ipCounter}`,
  userAgent: 'vitest',
  now: T0,
  checkPow: async () => 'ok' as const,
  ...overrides,
})

beforeAll(async () => {
  await migrate(drizzle(pg), { migrationsFolder: './drizzle' })
  await seed(db)
  ;({ oil1l, oil5l, olives } = await addTestProducts(db))
})

beforeEach(async () => {
  await db.delete(schema.orders)
  await db.delete(schema.rateLimits)
})

afterAll(async () => {
  await pg.close()
})

describe('placeOrder', () => {
  it('creates an order priced from the database', async () => {
    const result = await placeOrder(
      db,
      input({
        items: [
          { productId: oil1l, quantity: 2 },
          { productId: olives, quantity: 1 },
        ],
      }),
      ctx(),
    )
    expect(result.status).toBe('created')
    if (result.status !== 'created') return
    expect(result.reference).toMatch(/^OL-2026-\d{6}$/)
    // Numbering starts at 10001, never at 1.
    expect(Number(result.reference.split('-')[2])).toBeGreaterThanOrEqual(10001)

    const [order] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.reference, result.reference))
    expect(order).toMatchObject({
      phoneE164: '+212612345678',
      subtotal: '220.00', // 2 × 90 + 40
      deliveryFee: null, // default: confirmed by phone
      total: '220.00',
      status: 'new',
      locale: 'fr',
      address: null,
    })
    const items = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order?.id ?? ''))
    expect(
      items.map((i) => [i.productNameSnapshot, i.unitPriceSnapshot, i.quantity]).sort(),
    ).toEqual([
      ["Huile d'olive vierge extra — 1 litre", '90.00', 2],
      ['Olives vertes de table — 1 kg', '40.00', 1],
    ])
    const events = await db
      .select()
      .from(schema.orderEvents)
      .where(eq(schema.orderEvents.orderId, order?.id ?? ''))
    expect(events).toHaveLength(1)
    expect(events[0]?.toStatus).toBe('new')
  })

  it('numbers references sequentially', async () => {
    const a = await placeOrder(db, input({ phone: '0611111111' }), ctx())
    const b = await placeOrder(db, input({ phone: '0622222222' }), ctx())
    if (a.status !== 'created' || b.status !== 'created') throw new Error('expected created')
    const n = (ref: string) => Number(ref.split('-')[2])
    expect(n(b.reference)).toBe(n(a.reference) + 1)
  })

  it('applies the delivery rules from settings', async () => {
    await db
      .update(schema.settings)
      .set({ value: { mode: 'free_above', fee: 30, freeAbove: 300 } })
      .where(eq(schema.settings.key, 'delivery'))
    const small = await placeOrder(db, input({ phone: '0633333333' }), ctx())
    const big = await placeOrder(
      db,
      input({ phone: '0644444444', items: [{ productId: oil5l, quantity: 1 }] }),
      ctx(),
    )
    const totals = await db
      .select({
        ref: schema.orders.reference,
        fee: schema.orders.deliveryFee,
        total: schema.orders.total,
      })
      .from(schema.orders)
    const find = (r: typeof small) =>
      totals.find((x) => r.status === 'created' && x.ref === r.reference)
    expect(find(small)).toMatchObject({ fee: '30.00', total: '210.00' })
    expect(find(big)).toMatchObject({ fee: '0.00', total: '420.00' })
    await db
      .update(schema.settings)
      .set({ value: { mode: 'confirm' } })
      .where(eq(schema.settings.key, 'delivery'))
  })

  it('charges what Admin → Settings → delivery says, for each of the four choices', async () => {
    const setDelivery = (value: unknown) =>
      db.update(schema.settings).set({ value }).where(eq(schema.settings.key, 'delivery'))
    const feeFor = async (choice: Parameters<typeof deliveryFromChoice>[0], phone: string) => {
      await setDelivery(deliveryFromChoice(choice))
      const r = await placeOrder(db, input({ phone }), ctx()) // 2 × 90 = 180
      if (r.status !== 'created') throw new Error(r.status)
      const [o] = await db
        .select({ fee: schema.orders.deliveryFee, total: schema.orders.total })
        .from(schema.orders)
        .where(eq(schema.orders.reference, r.reference))
      return o
    }
    expect(await feeFor({ choice: 'flat', fee: 35 }, '0611000101')).toEqual({
      fee: '35.00',
      total: '215.00',
    })
    expect(await feeFor({ choice: 'free_above', fee: 35, freeAbove: 150 }, '0611000102')).toEqual({
      fee: '0.00',
      total: '180.00',
    })
    expect(await feeFor({ choice: 'free_above', fee: 35, freeAbove: 500 }, '0611000103')).toEqual({
      fee: '35.00',
      total: '215.00',
    })
    expect(await feeFor({ choice: 'free' }, '0611000104')).toEqual({
      fee: '0.00',
      total: '180.00',
    })
    expect(await feeFor({ choice: 'confirm', fee: 99 }, '0611000105')).toEqual({
      fee: null,
      total: '180.00',
    })
  })

  it('keeps where the visitor came from (utm / fbclid), and only those tags', async () => {
    const r = await placeOrder(
      db,
      input({
        phone: '0611000201',
        attribution: {
          utm_source: 'facebook',
          utm_campaign: 'ramadan-30l',
          fbclid: 'IwAR123',
          password: 'not stored',
        },
      }),
      ctx(),
    )
    if (r.status !== 'created') throw new Error(r.status)
    const [o] = await db
      .select({ attribution: schema.orders.attribution })
      .from(schema.orders)
      .where(eq(schema.orders.reference, r.reference))
    expect(o?.attribution).toEqual({
      utm_source: 'facebook',
      utm_campaign: 'ramadan-30l',
      fbclid: 'IwAR123',
    })
    expect(describeAttribution(o?.attribution)).toBe('facebook · ramadan-30l')
  })

  it('returns translated field errors for invalid input', async () => {
    const result = await placeOrder(
      db,
      input({ name: 'A', phone: '0812345678', city: '', items: [] }),
      ctx(),
    )
    expect(result).toEqual({
      status: 'invalid',
      fieldErrors: {
        name: 'validation.nameRequired',
        phone: 'validation.phoneInvalid',
        city: 'validation.cityRequired',
        items: 'validation.itemsRequired',
      },
    })
  })

  it('rejects bots: honeypot, instant submit, forged token', async () => {
    expect((await placeOrder(db, input({ website: 'http://spam' }), ctx())).status).toBe('rejected')
    expect(
      (await placeOrder(db, input({ formToken: issueFormToken(T0.getTime() - 500) }), ctx()))
        .status,
    ).toBe('rejected')
    expect(
      (await placeOrder(db, input({ formToken: `${T0.getTime() - 10_000}.forged` }), ctx())).status,
    ).toBe('rejected')
    expect(await db.select().from(schema.orders)).toHaveLength(0)
  })

  it('rejects a submission without a valid proof of work', async () => {
    for (const verdict of ['missing', 'invalid', 'replayed'] as const) {
      const result = await placeOrder(db, input(), ctx({ checkPow: async () => verdict }))
      expect(result.status).toBe('rejected')
    }
    expect(await db.select().from(schema.orders)).toHaveLength(0)
  })

  it('rejects when Turnstile verification fails', async () => {
    const result = await placeOrder(db, input(), ctx({ verifyTurnstile: async () => false }))
    expect(result.status).toBe('rejected')
  })

  it('refuses out-of-stock and inactive products', async () => {
    await db
      .update(schema.products)
      .set({ stockStatus: 'out_of_stock' })
      .where(eq(schema.products.id, olives))
    const result = await placeOrder(
      db,
      input({ items: [{ productId: olives, quantity: 1 }] }),
      ctx(),
    )
    expect(result).toEqual({ status: 'unavailable', productIds: [olives] })
    await db
      .update(schema.products)
      .set({ stockStatus: 'in_stock' })
      .where(eq(schema.products.id, olives))
  })

  it('warns about a duplicate within 10 minutes, unless confirmed', async () => {
    const first = await placeOrder(db, input(), ctx())
    expect(first.status).toBe('created')

    const later = new Date(T0.getTime() + 4 * 60_000)
    const dup = await placeOrder(db, input({ phone: '+212 6 12 34 56 78' }), ctx({ now: later }))
    expect(dup).toMatchObject({ status: 'duplicate', minutesAgo: 4 })
    if (first.status === 'created' && dup.status === 'duplicate')
      expect(dup.reference).toBe(first.reference)

    // A different product from the same phone is not a duplicate.
    const other = await placeOrder(
      db,
      input({ items: [{ productId: olives, quantity: 1 }] }),
      ctx({ now: later }),
    )
    expect(other.status).toBe('created')

    const confirmed = await placeOrder(db, input({ confirmDuplicate: true }), ctx({ now: later }))
    expect(confirmed.status).toBe('created')
  })

  it('does not flag orders older than 10 minutes as duplicates', async () => {
    await placeOrder(db, input(), ctx())
    const after = await placeOrder(db, input(), ctx({ now: new Date(T0.getTime() + 11 * 60_000) }))
    expect(after.status).toBe('created')
  })

  it('rate-limits per phone and per IP', async () => {
    const phoneResults = []
    for (let i = 0; i < 6; i++) {
      phoneResults.push((await placeOrder(db, input({ confirmDuplicate: true }), ctx())).status)
    }
    expect(phoneResults).toEqual([...Array(5).fill('created'), 'rate_limited'])

    const ipResults = []
    for (let i = 0; i < 6; i++) {
      ipResults.push(
        (await placeOrder(db, input({ phone: `06000000${10 + i}` }), ctx({ ipHash: 'same-ip' })))
          .status,
      )
    }
    expect(ipResults.slice(0, 5).every((s) => s === 'created')).toBe(true)
    expect(ipResults[5]).toBe('rate_limited')
  })
})

describe('olive oil by the litre', () => {
  it('prices a custom number of litres from the price per litre', async () => {
    const r = await placeOrder(db, input({ items: [], customLiters: 45 }), ctx())
    if (r.status !== 'created') throw new Error(`expected created, got ${r.status}`)
    expect(r.summary.subtotal).toBe('4050.00') // 45 × 90 (seeded demo price)
    const items = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, r.summary.id))
    expect(items).toEqual([
      expect.objectContaining({
        productId: null,
        productNameSnapshot: "Huile d'olive — au litre",
        unitPriceSnapshot: '90.00',
        quantity: 45,
      }),
    ])
  })

  it('refuses litres outside the limits or while the option is off', async () => {
    const invalid = { status: 'invalid', fieldErrors: { customLiters: 'validation.litersRange' } }
    expect(await placeOrder(db, input({ items: [], customLiters: 2 }), ctx())).toEqual(invalid)
    expect(await placeOrder(db, input({ items: [], customLiters: 501 }), ctx())).toEqual(invalid)
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'pricing'))
    await db
      .update(schema.settings)
      .set({ value: { ...(row?.value as object), customEnabled: false } })
      .where(eq(schema.settings.key, 'pricing'))
    expect(await placeOrder(db, input({ items: [], customLiters: 45 }), ctx())).toEqual(invalid)
    await db
      .update(schema.settings)
      .set({ value: row?.value })
      .where(eq(schema.settings.key, 'pricing'))
  })
})

describe('concurrent submissions', () => {
  it('give every order its own reference', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        placeOrder(db, input({ phone: `0670${String(i).padStart(6, '0')}` }), ctx()),
      ),
    )
    const refs = results.map((r) => (r.status === 'created' ? r.reference : r.status))
    expect(refs.every((r) => r.startsWith('OL-'))).toBe(true)
    expect(new Set(refs).size).toBe(25)
  })

  it('create only one order when the same phone sends the same product twice at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => placeOrder(db, input({ phone: '0699999999' }), ctx())),
    )
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual(['created', 'duplicate', 'duplicate', 'duplicate'])
  })
})

describe('getOrderConfirmation', () => {
  it('needs the matching token and hides deleted or old orders', async () => {
    const result = await placeOrder(db, input(), ctx())
    if (result.status !== 'created') throw new Error('expected created')
    const ok = await getOrderConfirmation(db, result.reference, result.viewToken, T0)
    expect(ok).toMatchObject({
      reference: result.reference,
      city: 'Marrakech',
      total: '180.00',
    })
    expect(ok).not.toHaveProperty('phoneE164')

    expect(await getOrderConfirmation(db, result.reference, 'x'.repeat(24), T0)).toBeNull()
    const otherToken = orderViewToken('OL-2026-999999')
    expect(await getOrderConfirmation(db, result.reference, otherToken, T0)).toBeNull()

    const in31Days = new Date(T0.getTime() + 31 * 24 * 3600_000)
    expect(await getOrderConfirmation(db, result.reference, result.viewToken, in31Days)).toBeNull()

    await db
      .update(schema.orders)
      .set({ deletedAt: T0 })
      .where(eq(schema.orders.reference, result.reference))
    expect(await getOrderConfirmation(db, result.reference, result.viewToken, T0)).toBeNull()
  })
})
