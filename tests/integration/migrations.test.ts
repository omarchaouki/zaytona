import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '~/db/schema'

/*
 * Applies the generated SQL migrations to an in-process Postgres (PGlite)
 * and checks the constraints the app relies on.
 */
const pg = new PGlite()
const db = drizzle(pg, { schema })

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './drizzle' })
})

afterAll(async () => {
  await pg.close()
})

async function insertOrder(phone: string) {
  const [row] = await db
    .insert(schema.orders)
    .values({
      reference: `TEST-${Math.random().toString(36).slice(2)}`,
      customerName: 'Demo',
      phoneE164: phone,
      city: 'Marrakech',
      subtotal: '100.00',
      total: '100.00',
      locale: 'ar',
    })
    .returning()
  return row
}

describe('migrations', () => {
  it('create every table', async () => {
    const { rows } = await pg.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    )
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        'admins',
        'audit_logs',
        'certifications',
        'content_blocks',
        'faqs',
        'gallery_images',
        'order_events',
        'order_items',
        'orders',
        'product_images',
        'product_lab_reports',
        'products',
        'rate_limits',
        'reviews',
        'sessions',
        'settings',
        'whatsapp_clicks',
      ]),
    )
  })

  it('number orders from a sequence', async () => {
    const a = await insertOrder('+212612345678')
    const b = await insertOrder('+212712345678')
    expect(a?.status).toBe('new')
    expect(b?.number).toBe((a?.number ?? 0) + 1)
  })

  it('reject non-E.164 Moroccan phones', async () => {
    await expect(insertOrder('0612345678')).rejects.toThrow()
  })

  it('enforce review rating and comment length', async () => {
    const review = { authorName: 'A', comment: 'Très bonne huile, merci.' }
    await expect(db.insert(schema.reviews).values({ ...review, rating: 6 })).rejects.toThrow()
    await expect(
      db.insert(schema.reviews).values({ ...review, rating: 5, comment: 'short' }),
    ).rejects.toThrow()
    const [ok] = await db
      .insert(schema.reviews)
      .values({ ...review, rating: 5 })
      .returning()
    expect(ok?.status).toBe('pending')
  })

  it('treat admin emails case-insensitively', async () => {
    await db.insert(schema.admins).values({ email: 'Owner@Example.com', passwordHash: 'x' })
    await expect(
      db.insert(schema.admins).values({ email: 'owner@example.com', passwordHash: 'x' }),
    ).rejects.toThrow()
  })
})
