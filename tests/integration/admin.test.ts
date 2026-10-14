import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '~/db/client'
import * as schema from '~/db/schema'
import { seed } from '~/db/seed-run'
import { orderFiltersSchema } from '~/lib/admin-orders'
import { deleteOffer, listOffers, saveOffer, savePricing } from '~/server/admin/offers'
import {
  dashboardStats,
  getOrderDetail,
  listOrders,
  markOrdersSeen,
  restoreOrders,
  setOrderStatus,
  setOrdersPaid,
  softDeleteOrders,
  unseenOrders,
  updateOrder,
} from '~/server/admin/orders'
import { changePassword, getSession, login, SESSION_TTL_MS } from '~/server/auth/session'
import { issueFormToken } from '~/server/form-token'
import { placeOrder } from '~/server/orders'
import { addTestProducts } from './fixtures'

const pg = new PGlite()
const db = drizzle(pg, { schema }) as unknown as Database
const EMAIL = 'owner@example.com'
const PASSWORD = 'first-password-1234'
const ctx = { ip: '127.0.0.1', ipHash: 'iphash', userAgent: 'vitest' }
let adminId = ''
let oil1l = ''

async function newOrder(phone: string) {
  const r = await placeOrder(
    db,
    {
      name: 'Amina',
      phone,
      city: 'Marrakech',
      items: [{ productId: oil1l, quantity: 2 }],
      locale: 'fr',
      formToken: issueFormToken(Date.now() - 10_000),
      website: '',
    },
    { ipHash: `ip-${phone}`, userAgent: 'vitest', checkPow: async () => 'ok' },
  )
  if (r.status !== 'created') throw new Error(`expected created, got ${r.status}`)
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.reference, r.reference))
  if (!o) throw new Error('order missing')
  return o
}

beforeAll(async () => {
  await migrate(drizzle(pg), { migrationsFolder: './drizzle' })
  await seed(db, { adminEmail: EMAIL, adminPassword: PASSWORD })
  const [a] = await db.select().from(schema.admins)
  adminId = a?.id ?? ''
  oil1l = (await addTestProducts(db)).oil1l
})

afterAll(async () => {
  await pg.close()
})

describe('login and sessions', () => {
  it('signs in with the right password (email is case-insensitive)', async () => {
    const r = await login(db, { email: '  Owner@Example.com ', password: PASSWORD }, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.admin.mustChangePassword).toBe(true)
    const session = await getSession(db, r.token)
    expect(session?.admin.email).toBe(EMAIL)
    expect(session?.csrfToken.length).toBeGreaterThan(20)
    // Only the hash of the token is stored.
    const rows = await db.select().from(schema.sessions)
    expect(rows.some((s) => s.id === r.token)).toBe(false)
  })

  it('rejects a wrong password or unknown email and records the attempt', async () => {
    expect((await login(db, { email: EMAIL, password: 'nope' }, { ...ctx, ipHash: 'x1' })).ok).toBe(
      false,
    )
    expect(
      (await login(db, { email: 'who@example.com', password: PASSWORD }, { ...ctx, ipHash: 'x2' }))
        .ok,
    ).toBe(false)
    const fails = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, 'login_failed'))
    expect(fails.length).toBeGreaterThanOrEqual(2)
  })

  it('locks an email after 5 attempts in 15 minutes', async () => {
    const email = 'locked@example.com'
    const results = []
    for (let i = 0; i < 6; i++) {
      results.push(await login(db, { email, password: 'x' }, { ...ctx, ipHash: `lock-${i}` }))
    }
    expect(results.at(-1)).toEqual({ ok: false, reason: 'rate_limited' })
  })

  it('expires sessions and ignores garbage tokens', async () => {
    const r = await login(db, { email: EMAIL, password: PASSWORD }, { ...ctx, ipHash: 'exp' })
    if (!r.ok) throw new Error('login failed')
    const later = new Date(Date.now() + SESSION_TTL_MS + 1000)
    expect(await getSession(db, r.token, later)).toBeNull()
    expect(await getSession(db, 'short')).toBeNull()
    expect(await getSession(db, undefined)).toBeNull()
  })

  it('changes the password, clears the flag and signs out other sessions', async () => {
    const a = await login(db, { email: EMAIL, password: PASSWORD }, { ...ctx, ipHash: 'pw1' })
    const b = await login(db, { email: EMAIL, password: PASSWORD }, { ...ctx, ipHash: 'pw2' })
    if (!a.ok || !b.ok) throw new Error('login failed')
    const sessionA = await getSession(db, a.token)
    if (!sessionA) throw new Error('no session')

    expect(
      await changePassword(db, sessionA, { current: 'wrong', next: 'x'.repeat(14) }, null),
    ).toEqual({
      ok: false,
      reason: 'wrong_current',
    })
    expect(await changePassword(db, sessionA, { current: PASSWORD, next: 'short' }, null)).toEqual({
      ok: false,
      reason: 'too_weak',
    })
    expect(
      await changePassword(
        db,
        sessionA,
        { current: PASSWORD, next: 'a brand new passphrase' },
        null,
      ),
    ).toEqual({ ok: true })

    expect(await getSession(db, a.token)).not.toBeNull()
    expect(await getSession(db, b.token)).toBeNull()
    const [admin] = await db.select().from(schema.admins)
    expect(admin?.mustChangePassword).toBe(false)
    expect(
      (await login(db, { email: EMAIL, password: PASSWORD }, { ...ctx, ipHash: 'pw3' })).ok,
    ).toBe(false)
    expect(
      (
        await login(
          db,
          { email: EMAIL, password: 'a brand new passphrase' },
          { ...ctx, ipHash: 'pw4' },
        )
      ).ok,
    ).toBe(true)
  })
})

describe('admin order operations', () => {
  const actor = () => ({ adminId, ip: '127.0.0.1' })

  it('changes status with a timeline event, in bulk too', async () => {
    const a = await newOrder('0611000001')
    const b = await newOrder('0611000002')
    const r = await setOrderStatus(db, actor(), [a.id, b.id], 'confirmed', 'called the customer')
    expect(r.changed).toBe(2)
    const detail = await getOrderDetail(db, a.id)
    expect(detail?.order.status).toBe('confirmed')
    expect(detail?.events[0]).toMatchObject({
      fromStatus: 'new',
      toStatus: 'confirmed',
      note: 'called the customer',
      adminEmail: EMAIL,
    })
    // Setting the same status again is a no-op.
    expect((await setOrderStatus(db, actor(), [a.id], 'confirmed')).changed).toBe(0)
  })

  it('recomputes totals when items or delivery change', async () => {
    const o = await newOrder('0611000004') // 2 × 90 = 180
    const detail = await getOrderDetail(db, o.id)
    const item = detail?.items[0]
    if (!item) throw new Error('no item')
    await updateOrder(db, actor(), o.id, { quantities: { [item.id]: 3 }, deliveryFee: 30 })
    const after = await getOrderDetail(db, o.id)
    expect(after?.order).toMatchObject({
      subtotal: '270.00',
      deliveryFee: '30.00',
      total: '300.00',
    })
    expect(await updateOrder(db, actor(), o.id, { quantities: { [item.id]: 0 } })).toEqual({
      ok: false,
      reason: 'empty',
    })
  })

  it('filters by phone in any format and hides deleted orders', async () => {
    const o = await newOrder('0622334455')
    const byPhone = await listOrders(db, { q: '+212 6 22 33 44 55' })
    expect(byPhone.rows.map((r) => r.id)).toEqual([o.id])
    const byRef = await listOrders(db, { q: o.reference })
    expect(byRef.total).toBe(1)

    expect(await softDeleteOrders(db, actor(), [o.id])).toEqual({ deleted: 1 })
    expect(await softDeleteOrders(db, actor(), [o.id])).toEqual({ deleted: 0 })
    expect((await listOrders(db, { q: o.reference })).total).toBe(0)
    expect(await getOrderDetail(db, o.id)).toBeNull()

    expect(await restoreOrders(db, actor(), [o.id])).toEqual({ restored: 1 })
    expect((await listOrders(db, { q: o.reference })).total).toBe(1)
  })

  it('pages orders 10 to 50 at a time (20 by default)', async () => {
    for (const phone of ['0644000001', '0644000002', '0644000003']) await newOrder(phone)
    const all = await listOrders(db, {})
    expect(all.pageSize).toBe(20)
    expect(all.total).toBeGreaterThanOrEqual(3)

    const tenPerPage = await listOrders(db, { size: 10 })
    expect(tenPerPage.pageSize).toBe(10)
    expect(tenPerPage.rows.length).toBe(Math.min(10, all.total))

    // Only the sizes on offer are accepted; anything else falls back to 20.
    expect(orderFiltersSchema.parse({ size: '30' }).size).toBe(30)
    expect(orderFiltersSchema.parse({ size: '25' }).size).toBeUndefined()
    expect(orderFiltersSchema.parse({ size: '500' }).size).toBeUndefined()
  })

  it('keeps new orders unseen until opened, and records cash received', async () => {
    const o = await newOrder('0633445566')
    const unseen = await unseenOrders(db)
    expect(unseen.latest.map((x) => x.id)).toContain(o.id)
    expect((await listOrders(db, { unseen: true })).rows.map((r) => r.id)).toContain(o.id)

    expect(await markOrdersSeen(db, [o.id])).toEqual({ marked: 1 })
    expect(await markOrdersSeen(db, [o.id])).toEqual({ marked: 0 })
    expect((await unseenOrders(db)).latest.map((x) => x.id)).not.toContain(o.id)

    const before = await dashboardStats(db)
    expect(await setOrdersPaid(db, actor(), [o.id], true)).toEqual({ changed: 1 })
    expect(await setOrdersPaid(db, actor(), [o.id], true)).toEqual({ changed: 0 })
    const after = await dashboardStats(db)
    expect(after.paid.amount - before.paid.amount).toBe(180) // 2 × 90
    expect(after.paid.monthCount - before.paid.monthCount).toBe(1)
    expect((await listOrders(db, { paid: 'paid' })).rows.map((r) => r.id)).toContain(o.id)
    const detail = await getOrderDetail(db, o.id)
    expect(detail?.order.paidAt).toBeInstanceOf(Date)
    expect(detail?.events[0]?.note).toBe('marked paid')

    expect(await setOrdersPaid(db, actor(), [o.id], false)).toEqual({ changed: 1 })
    expect((await dashboardStats(db)).paid.amount).toBe(before.paid.amount)
  })

  it('summarises the dashboard', async () => {
    const stats = await dashboardStats(db)
    expect(stats.total).toBeGreaterThan(0)
    expect(stats.days).toHaveLength(30)
    expect(stats.toDeliver.count).toBeGreaterThan(0)
    expect(stats.warnings).toMatchObject({ noWhatsapp: true, demoProducts: 3 })
  })
})

describe('offers and the price per litre', () => {
  const actor = () => ({ adminId, ip: '127.0.0.1' })

  it('re-prices automatic offers when the price per litre changes', async () => {
    const r = await savePricing(db, actor(), {
      pricePerLiter: 85,
      customEnabled: true,
      customMinLiters: 10,
      customMaxLiters: 300,
    })
    expect(r.repriced).toBe(3)
    const { offers, pricing } = await listOffers(db)
    expect(offers.filter((o) => o.autoPrice).map((o) => [o.liters, o.price])).toEqual([
      [30, 2550],
      [60, 5100],
      [90, 7650],
    ])
    expect(pricing).toMatchObject({ pricePerLiter: 85, isDemo: false, customMinLiters: 10 })
  })

  it('creates automatic and fixed-price offers, then deletes one', async () => {
    const base = { nameAr: 'زيت الزيتون', nameFr: "Huile d'olive", isActive: true }
    const auto = await saveOffer(db, actor(), { ...base, liters: 20, autoPrice: true })
    const fixed = await saveOffer(db, actor(), {
      ...base,
      liters: 120,
      autoPrice: false,
      price: 9500,
    })
    if (!auto.ok || !fixed.ok) throw new Error('save failed')
    const byId = async (id: string) => (await listOffers(db)).offers.find((o) => o.id === id)
    expect(await byId(auto.id)).toMatchObject({ price: 1700, sizeLabelAr: '20 لتر', isDemo: false })
    expect(await byId(fixed.id)).toMatchObject({ price: 9500, autoPrice: false })

    // The fixed price does not follow the price per litre.
    await savePricing(db, actor(), {
      pricePerLiter: 100,
      customEnabled: true,
      customMinLiters: 10,
      customMaxLiters: 300,
    })
    expect((await byId(auto.id))?.price).toBe(2000)
    expect((await byId(fixed.id))?.price).toBe(9500)

    expect(await deleteOffer(db, actor(), fixed.id)).toEqual({ ok: true })
    expect(await byId(fixed.id)).toBeUndefined()
  })
})
