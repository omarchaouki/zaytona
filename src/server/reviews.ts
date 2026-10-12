import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import type { Database } from '~/db/client'
import { admins, auditLogs, orders, type ReviewStatus, reviews } from '~/db/schema'
import type { Locale } from '~/i18n/config'
import { moroccoDay } from '~/lib/format'
import { type ImageSources, resolveImage } from '~/lib/images'
import { normalizeMoroccanPhone } from '~/lib/phone'
import {
  detectLanguage,
  displayName,
  REVIEW_PHOTO_MAX_MB,
  type ReviewSummary,
  reviewInputSchema,
} from '~/lib/reviews'
import { hashPhone } from './crypto'
import { checkFormToken } from './form-token'
import { checkPow, type PowCheck } from './pow'
import { consumeRateLimit } from './rate-limit'
import { type StorageDriver, storeImage, UploadError } from './storage'

/* ------------------------------------------------------------ submission */

export type SubmitReviewResult =
  | { status: 'ok' }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  | { status: 'photo_error'; code: 'too_large' | 'not_image' | 'too_small' }
  | { status: 'rate_limited' }
  | { status: 'rejected' }

export const REVIEW_LIMIT_PER_IP = { max: 3, windowSeconds: 60 * 60 }

export async function submitReview(
  db: Database,
  raw: unknown,
  photo: Uint8Array | null,
  ctx: {
    ipHash: string | null
    now?: Date
    storage?: StorageDriver
    /** Proof-of-work check; defaults to the real one (tests swap it out). */
    checkPow?: (payload: string | undefined) => Promise<PowCheck>
  },
): Promise<SubmitReviewResult> {
  const parsed = reviewInputSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
    }
    return { status: 'invalid', fieldErrors }
  }
  const input = parsed.data
  const now = ctx.now ?? new Date()
  if (input.website) return { status: 'rejected' }
  if (checkFormToken(input.formToken, now.getTime()) !== 'ok') return { status: 'rejected' }
  const pow = ctx.checkPow ?? ((payload) => checkPow(db, payload))
  if ((await pow(input.altcha)) !== 'ok') return { status: 'rejected' }
  if (
    !(await consumeRateLimit(
      db,
      `review:ip:${ctx.ipHash ?? 'unknown'}`,
      REVIEW_LIMIT_PER_IP.max,
      REVIEW_LIMIT_PER_IP.windowSeconds,
    ))
  ) {
    return { status: 'rate_limited' }
  }

  let stored: Awaited<ReturnType<typeof storeImage>> | null = null
  if (photo && photo.byteLength > 0) {
    try {
      stored = await storeImage(photo, {
        maxBytes: REVIEW_PHOTO_MAX_MB * 1024 * 1024,
        driver: ctx.storage,
      })
    } catch (error) {
      if (error instanceof UploadError) return { status: 'photo_error', code: error.code }
      throw error
    }
  }

  // "Verified purchase": the phone matches a delivered order. The phone itself is not stored.
  const e164 = input.phone ? normalizeMoroccanPhone(input.phone) : null
  let orderId: string | null = null
  if (e164) {
    const [delivered] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.phoneE164, e164), eq(orders.status, 'delivered')))
      .orderBy(desc(orders.createdAt))
      .limit(1)
    orderId = delivered?.id ?? null
  }

  await db.insert(reviews).values({
    authorName: input.name,
    city: input.city || null,
    rating: input.rating,
    comment: input.comment,
    language: detectLanguage(input.comment),
    phoneHash: e164 ? hashPhone(e164) : null,
    orderId,
    status: 'pending',
    photoUrl: stored?.key ?? null,
    photoWidth: stored?.width ?? null,
    photoHeight: stored?.height ?? null,
    ipHash: ctx.ipHash,
    createdAt: now,
  })
  return { status: 'ok' }
}

/* ---------------------------------------------------------------- public */

/** Approved reviews by stars. `realOnly` leaves out the template's example reviews. */
export async function reviewSummary(
  db: Database,
  opts: { realOnly?: boolean } = {},
): Promise<ReviewSummary> {
  const rows = await db
    .select({ rating: reviews.rating, n: count() })
    .from(reviews)
    .where(
      and(eq(reviews.status, 'approved'), opts.realOnly ? eq(reviews.isDemo, false) : undefined),
    )
    .groupBy(reviews.rating)
  const distribution: ReviewSummary['distribution'] = [0, 0, 0, 0, 0]
  let total = 0
  let sum = 0
  for (const r of rows) {
    distribution[r.rating - 1] = r.n
    total += r.n
    sum += r.rating * r.n
  }
  return { count: total, average: total ? Math.round((sum / total) * 10) / 10 : 0, distribution }
}

export type PublicReview = {
  id: string
  name: string
  city: string | null
  rating: number
  comment: string
  language: string
  createdAt: string
  /** Day of the review in Morocco, "YYYY-MM-DD" (display without time-zone drift). */
  day: string
  verified: boolean
  photo: ImageSources | null
  reply: string | null
  /** Example review from the template: shown with a badge, never in structured data. */
  isDemo: boolean
}

export const REVIEWS_PAGE_SIZE = 6

/** Approved reviews: featured first, then newest. Optionally filtered by star count. */
export async function listApprovedReviews(
  db: Database,
  locale: Locale,
  opts: { page?: number; stars?: number } = {},
) {
  const page = Math.max(1, opts.page ?? 1)
  const where = and(
    eq(reviews.status, 'approved'),
    opts.stars ? eq(reviews.rating, opts.stars) : undefined,
  )
  const rows = await db
    .select({ review: reviews, orderStatus: orders.status })
    .from(reviews)
    .leftJoin(orders, eq(orders.id, reviews.orderId))
    .where(where)
    .orderBy(desc(reviews.isFeatured), desc(reviews.createdAt))
    .limit(REVIEWS_PAGE_SIZE + 1)
    .offset((page - 1) * REVIEWS_PAGE_SIZE)
  const items: PublicReview[] = rows
    .slice(0, REVIEWS_PAGE_SIZE)
    .map(({ review: r, orderStatus }) => ({
      id: r.id,
      name: displayName(r.authorName),
      city: r.city,
      rating: r.rating,
      comment: r.comment,
      language: r.language,
      createdAt: r.createdAt.toISOString(),
      day: moroccoDay(r.createdAt),
      verified: orderStatus === 'delivered',
      photo: r.photoUrl
        ? resolveImage(r.photoUrl, { width: r.photoWidth, height: r.photoHeight })
        : null,
      reply: (locale === 'ar' ? r.replyAr : r.replyFr) ?? r.replyAr ?? r.replyFr ?? null,
      isDemo: r.isDemo,
    }))
  return { items, hasMore: rows.length > REVIEWS_PAGE_SIZE, page }
}

/* ----------------------------------------------------------------- admin */

export type ReviewActor = { adminId: string; ip: string | null }

export async function adminListReviews(
  db: Database,
  opts: { status?: ReviewStatus; q?: string; page?: number },
) {
  const page = Math.max(1, opts.page ?? 1)
  const q = opts.q?.trim().replace(/[%_]/g, '')
  const where = and(
    opts.status ? eq(reviews.status, opts.status) : undefined,
    q ? or(ilike(reviews.authorName, `%${q}%`), ilike(reviews.comment, `%${q}%`)) : undefined,
  )
  const [rows, [total], statusCounts] = await Promise.all([
    db
      .select({
        review: reviews,
        orderReference: orders.reference,
        orderStatus: orders.status,
        moderatorEmail: admins.email,
      })
      .from(reviews)
      .leftJoin(orders, eq(orders.id, reviews.orderId))
      .leftJoin(admins, eq(admins.id, reviews.moderatedBy))
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(20)
      .offset((page - 1) * 20),
    db.select({ n: count() }).from(reviews).where(where),
    db.select({ status: reviews.status, n: count() }).from(reviews).groupBy(reviews.status),
  ])
  return {
    rows: rows.map(({ review, orderReference, orderStatus, moderatorEmail }) => ({
      ...review,
      photo: review.photoUrl
        ? resolveImage(review.photoUrl, { width: review.photoWidth, height: review.photoHeight })
        : null,
      orderReference,
      verified: orderStatus === 'delivered',
      moderatorEmail,
    })),
    total: total?.n ?? 0,
    page,
    counts: Object.fromEntries(statusCounts.map((c) => [c.status, c.n])) as Partial<
      Record<ReviewStatus, number>
    >,
  }
}

export async function pendingReviewCount(db: Database) {
  const [row] = await db.select({ n: count() }).from(reviews).where(eq(reviews.status, 'pending'))
  return row?.n ?? 0
}

export type ModerationAction =
  | { type: 'approve' }
  | { type: 'reject'; reason?: string }
  | { type: 'feature'; featured: boolean }
  | { type: 'delete' }

export async function moderateReviews(
  db: Database,
  actor: ReviewActor,
  ids: string[],
  action: ModerationAction,
) {
  if (ids.length === 0) return { changed: 0 }
  const now = new Date()
  const target = inArray(reviews.id, ids)
  let changed = 0
  if (action.type === 'delete') {
    changed = (await db.delete(reviews).where(target).returning({ id: reviews.id })).length
  } else if (action.type === 'feature') {
    changed = (
      await db
        .update(reviews)
        .set({ isFeatured: action.featured })
        .where(target)
        .returning({ id: reviews.id })
    ).length
  } else {
    changed = (
      await db
        .update(reviews)
        .set({
          status: action.type === 'approve' ? 'approved' : 'rejected',
          rejectionReason: action.type === 'reject' ? action.reason || null : null,
          moderatedAt: now,
          moderatedBy: actor.adminId,
        })
        .where(target)
        .returning({ id: reviews.id })
    ).length
  }
  await db.insert(auditLogs).values(
    ids.map((id) => ({
      adminId: actor.adminId,
      action: `review_${action.type}`,
      entity: 'review',
      entityId: id,
      meta: action.type === 'reject' ? { reason: action.reason } : null,
      ip: actor.ip,
    })),
  )
  return { changed }
}

/** Fix typos (the customer's original text is kept once) and reply in AR / FR. */
export async function editReview(
  db: Database,
  actor: ReviewActor,
  id: string,
  edit: { comment?: string; replyAr?: string | null; replyFr?: string | null },
) {
  const [current] = await db.select().from(reviews).where(eq(reviews.id, id))
  if (!current) return { ok: false as const }
  const commentChanged = edit.comment !== undefined && edit.comment.trim() !== current.comment
  await db
    .update(reviews)
    .set({
      ...(commentChanged
        ? {
            comment: edit.comment?.trim(),
            originalComment: current.originalComment ?? current.comment,
          }
        : {}),
      ...(edit.replyAr !== undefined ? { replyAr: edit.replyAr?.trim() || null } : {}),
      ...(edit.replyFr !== undefined ? { replyFr: edit.replyFr?.trim() || null } : {}),
    })
    .where(eq(reviews.id, id))
  await db.insert(auditLogs).values({
    adminId: actor.adminId,
    action: 'review_edit',
    entity: 'review',
    entityId: id,
    meta: { commentChanged },
    ip: actor.ip,
  })
  return { ok: true as const }
}
