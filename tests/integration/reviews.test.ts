import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '~/db/client'
import * as schema from '~/db/schema'
import { seed } from '~/db/seed-run'
import { detectLanguage, displayName } from '~/lib/reviews'
import { issueFormToken } from '~/server/form-token'
import {
  editReview,
  listApprovedReviews,
  moderateReviews,
  pendingReviewCount,
  reviewSummary,
  submitReview,
} from '~/server/reviews'
import type { StorageDriver } from '~/server/storage'

const pg = new PGlite()
const db = drizzle(pg, { schema }) as unknown as Database
const files = new Map<string, Buffer>()
const memory: StorageDriver = {
  put: async (name, data) => void files.set(name, data),
  get: async (name) => files.get(name) ?? null,
}
let adminId = ''
let ip = 0

const review = (over: Record<string, unknown> = {}) => ({
  name: 'Khadija Amrani',
  rating: 5,
  comment: 'زيت رائع، الطعم ممتاز والتوصيل سريع.',
  city: 'Rabat',
  phone: '',
  locale: 'ar',
  formToken: issueFormToken(Date.now() - 10_000),
  website: '',
  ...over,
})
const ctx = () => ({ ipHash: `ip-${++ip}`, storage: memory, checkPow: async () => 'ok' as const })

beforeAll(async () => {
  await migrate(drizzle(pg), { migrationsFolder: './drizzle' })
  await seed(db, { adminEmail: 'owner@example.com', adminPassword: 'a-long-password-here' })
  adminId = (await db.select().from(schema.admins))[0]?.id ?? ''
})
beforeEach(async () => {
  await db.delete(schema.reviews)
})
afterAll(async () => {
  await pg.close()
})

describe('submitReview', () => {
  it('stores a pending review, detecting the language', async () => {
    expect(await submitReview(db, review(), null, ctx())).toEqual({ status: 'ok' })
    const [row] = await db.select().from(schema.reviews)
    expect(row).toMatchObject({ status: 'pending', rating: 5, language: 'ar', orderId: null })
    expect(await pendingReviewCount(db)).toBe(1)
  })

  it('re-encodes an uploaded photo and keeps its size', async () => {
    const png = await sharp({
      create: { width: 900, height: 600, channels: 3, background: '#7a8a3a' },
    })
      .png()
      .toBuffer()
    expect(await submitReview(db, review(), new Uint8Array(png), ctx())).toEqual({ status: 'ok' })
    const [row] = await db.select().from(schema.reviews)
    expect(row?.photoUrl).toMatch(/^upload:[0-9a-f-]{36}$/)
    expect(row).toMatchObject({ photoWidth: 900, photoHeight: 600 })
    const id = row?.photoUrl?.slice('upload:'.length)
    expect([...files.keys()].filter((k) => k.startsWith(id ?? '?')).sort()).toEqual([
      `${id}-480.avif`,
      `${id}-480.webp`,
      `${id}-900.avif`,
      `${id}-900.webp`,
    ])
  })

  it('refuses files that are not images, whatever their name', async () => {
    const fake = new TextEncoder().encode('<script>alert(1)</script>')
    expect(await submitReview(db, review(), fake, ctx())).toEqual({
      status: 'photo_error',
      code: 'not_image',
    })
    expect(await db.select().from(schema.reviews)).toHaveLength(0)
  })

  it('validates fields with translated messages', async () => {
    const r = await submitReview(
      db,
      review({ rating: 0, comment: 'short', phone: '123' }),
      null,
      ctx(),
    )
    expect(r).toEqual({
      status: 'invalid',
      fieldErrors: {
        rating: 'reviews.errors.rating',
        comment: 'reviews.errors.commentShort',
        phone: 'validation.phoneInvalid',
      },
    })
  })

  it('rejects bots and limits submissions per IP', async () => {
    expect((await submitReview(db, review({ website: 'x' }), null, ctx())).status).toBe('rejected')
    const sameIp = { ...ctx(), ipHash: 'one-ip' }
    const statuses = []
    for (let i = 0; i < 4; i++)
      statuses.push((await submitReview(db, review(), null, sameIp)).status)
    expect(statuses).toEqual(['ok', 'ok', 'ok', 'rate_limited'])
  })

  it('marks a review verified when the phone matches a delivered order', async () => {
    const [order] = await db
      .insert(schema.orders)
      .values({
        reference: 'OL-T-1',
        customerName: 'Khadija',
        phoneE164: '+212612000111',
        city: 'Rabat',
        subtotal: '90',
        total: '90',
        locale: 'ar',
        status: 'delivered',
      })
      .returning()
    await submitReview(db, review({ phone: '06 12 00 01 11' }), null, ctx())
    const [row] = await db.select().from(schema.reviews)
    expect(row?.orderId).toBe(order?.id)
    expect(row?.phoneHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('moderation and public listing', () => {
  it('lists and counts only approved reviews, featured first', async () => {
    for (const [rating, name] of [
      [5, 'Amina Alaoui'],
      [4, 'Youssef Idrissi'],
      [2, 'Sara Bennani'],
    ] as const) {
      await submitReview(
        db,
        review({ rating, name, comment: `Avis de test numéro ${rating}, merci.` }),
        null,
        ctx(),
      )
    }
    const rows = await db.select().from(schema.reviews)
    const byName = (n: string) => rows.find((r) => r.authorName === n)?.id ?? ''
    expect((await reviewSummary(db)).count).toBe(0)

    const actor = { adminId, ip: null }
    await moderateReviews(db, actor, [byName('Amina Alaoui'), byName('Youssef Idrissi')], {
      type: 'approve',
    })
    await moderateReviews(db, actor, [byName('Sara Bennani')], { type: 'reject', reason: 'spam' })
    await moderateReviews(db, actor, [byName('Youssef Idrissi')], {
      type: 'feature',
      featured: true,
    })

    expect(await reviewSummary(db)).toEqual({
      count: 2,
      average: 4.5,
      distribution: [0, 0, 0, 1, 1],
    })
    const list = await listApprovedReviews(db, 'fr')
    expect(list.items.map((r) => r.name)).toEqual(['Youssef I.', 'Amina A.'])
    expect((await listApprovedReviews(db, 'fr', { stars: 5 })).items.map((r) => r.rating)).toEqual([
      5,
    ])

    const audit = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, 'review_reject'))
    expect(audit[0]?.meta).toEqual({ reason: 'spam' })
  })

  it('keeps the original text when an admin fixes a typo, and shows replies', async () => {
    await submitReview(db, review({ comment: 'Trés bonne huile, merci beaucoup.' }), null, ctx())
    const [row] = await db.select().from(schema.reviews)
    const actor = { adminId, ip: null }
    await editReview(db, actor, row?.id ?? '', {
      comment: 'Très bonne huile, merci beaucoup.',
      replyFr: 'Merci Khadija !',
    })
    await editReview(db, actor, row?.id ?? '', { comment: 'Très bonne huile, merci !' })
    const [after] = await db.select().from(schema.reviews)
    expect(after?.originalComment).toBe('Trés bonne huile, merci beaucoup.')
    await moderateReviews(db, actor, [row?.id ?? ''], { type: 'approve' })
    expect((await listApprovedReviews(db, 'ar')).items[0]?.reply).toBe('Merci Khadija !')
  })
})

describe('helpers', () => {
  it('shortens surnames and detects the language', () => {
    expect(displayName('Fatima Zahra Bennani')).toBe('Fatima Zahra B.')
    expect(displayName('Omar')).toBe('Omar')
    expect(detectLanguage('زيت ممتاز جداً')).toBe('ar')
    expect(detectLanguage('Huile excellente')).toBe('fr')
  })
})
