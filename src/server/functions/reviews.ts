import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '~/db/client'
import { LOCALES } from '~/i18n/config'
import { adminAuth, adminMutation, ownerOnly } from '../auth/middleware'
import { hashIp } from '../crypto'
import { clientIp } from '../request'
import {
  adminListReviews,
  editReview,
  listApprovedReviews,
  moderateReviews,
  pendingReviewCount,
  submitReview,
} from '../reviews'

/* ---------------------------------------------------------------- public */

/** Multipart: the review fields plus an optional `photo` file. */
export const submitReviewFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error('Expected multipart form data')
    return data
  })
  .handler(async ({ data }) => {
    const field = (k: string) => {
      const v = data.get(k)
      return typeof v === 'string' ? v : ''
    }
    const photo = data.get('photo')
    const bytes =
      photo instanceof Blob && photo.size > 0 ? new Uint8Array(await photo.arrayBuffer()) : null
    return submitReview(
      db(),
      {
        name: field('name'),
        rating: Number(field('rating')),
        comment: field('comment'),
        city: field('city'),
        phone: field('phone'),
        locale: field('locale'),
        formToken: field('formToken'),
        website: field('website'),
        altcha: field('altcha'),
      },
      bytes,
      { ipHash: hashIp(clientIp()) },
    )
  })

export const getReviewsPage = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      locale: z.enum(LOCALES),
      page: z.number().int().min(1).max(500),
      stars: z.number().int().min(1).max(5).optional(),
    }),
  )
  .handler(({ data }) => listApprovedReviews(db(), data.locale, data))

/* ----------------------------------------------------------------- admin */

const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const

export const adminGetReviews = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .inputValidator(
    z.object({
      status: z.enum(REVIEW_STATUSES).optional(),
      q: z.string().max(100).optional(),
      page: z.number().int().min(1).max(1000).optional(),
    }),
  )
  .handler(({ data }) => adminListReviews(db(), data))

export const adminPendingReviews = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .handler(() => pendingReviewCount(db()))

export const adminModerateReviews = createServerFn({ method: 'POST' })
  .middleware([adminMutation])
  .inputValidator(
    z.object({
      ids: z.array(z.uuid()).min(1).max(200),
      action: z.discriminatedUnion('type', [
        z.object({ type: z.literal('approve') }),
        z.object({ type: z.literal('reject'), reason: z.string().max(300).optional() }),
        z.object({ type: z.literal('feature'), featured: z.boolean() }),
      ]),
    }),
  )
  .handler(({ data, context }) =>
    moderateReviews(
      db(),
      { adminId: context.session.admin.id, ip: context.ip },
      data.ids,
      data.action,
    ),
  )

/** Deleting is permanent (the photo stays unreferenced on disk): owners only. */
export const adminDeleteReviews = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(z.object({ ids: z.array(z.uuid()).min(1).max(200) }))
  .handler(({ data, context }) =>
    moderateReviews(db(), { adminId: context.session.admin.id, ip: context.ip }, data.ids, {
      type: 'delete',
    }),
  )

export const adminEditReview = createServerFn({ method: 'POST' })
  .middleware([adminMutation])
  .inputValidator(
    z.object({
      id: z.uuid(),
      comment: z.string().trim().min(10).max(600).optional(),
      replyAr: z.string().max(1000).nullable().optional(),
      replyFr: z.string().max(1000).nullable().optional(),
    }),
  )
  .handler(({ data, context }) => {
    const { id, ...edit } = data
    return editReview(db(), { adminId: context.session.admin.id, ip: context.ip }, id, edit)
  })
