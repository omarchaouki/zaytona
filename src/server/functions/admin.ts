import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/db/client'
import { admins, products } from '~/db/schema'
import { LOCALES } from '~/i18n/config'
import { ORDER_STATUSES, orderFiltersSchema } from '~/lib/admin-orders'
import { PASSWORD_MIN } from '~/lib/csrf-client'
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
} from '../admin/orders'
import {
  adminAuth,
  adminMutation,
  clearSessionCookie,
  ownerOnly,
  readSession,
  setSessionCookie,
} from '../auth/middleware'
import { changePassword, login, logout } from '../auth/session'
import { hashIp } from '../crypto'
import { clientIp } from '../request'
import { getSettings } from '../settings'

/* ------------------------------------------------------------------- auth */

/** Current admin + CSRF token, or null. Used by the admin layout's beforeLoad. */
export const getAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await readSession()
  if (!session) return null
  return { admin: session.admin, csrfToken: session.csrfToken }
})

export const adminLogin = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: z.string().trim().max(200), password: z.string().max(200) }))
  .handler(async ({ data }) => {
    const ip = clientIp() ?? null
    const result = await login(db(), data, {
      ip,
      ipHash: hashIp(ip),
      userAgent: getRequestHeader('user-agent') ?? null,
    })
    if (!result.ok) return { ok: false as const, reason: result.reason }
    setSessionCookie(result.token)
    return { ok: true as const, mustChangePassword: result.admin.mustChangePassword }
  })

export const adminLogout = createServerFn({ method: 'POST' })
  .middleware([adminMutation])
  .handler(async ({ context }) => {
    await logout(db(), context.session, context.ip)
    clearSessionCookie()
    return { ok: true }
  })

export const adminChangePassword = createServerFn({ method: 'POST' })
  .middleware([adminMutation])
  .inputValidator(
    z.object({
      current: z.string().max(200),
      next: z.string().min(PASSWORD_MIN).max(200),
    }),
  )
  .handler(({ data, context }) => changePassword(db(), context.session, data, context.ip))

export const adminSetLocale = createServerFn({ method: 'POST' })
  .middleware([adminMutation])
  .inputValidator(z.object({ locale: z.enum(LOCALES) }))
  .handler(async ({ data, context }) => {
    await db()
      .update(admins)
      .set({ uiLocale: data.locale })
      .where(eq(admins.id, context.session.admin.id))
    return { ok: true }
  })

/* ---------------------------------------------------------------- reading */

export const getDashboard = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .handler(() => dashboardStats(db()))

export const getOrdersPage = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .inputValidator(orderFiltersSchema)
  .handler(async ({ data }) => {
    const [page, productRows] = await Promise.all([
      listOrders(db(), data),
      db()
        .select({
          id: products.id,
          nameAr: products.nameAr,
          nameFr: products.nameFr,
          sizeAr: products.sizeLabelAr,
          sizeFr: products.sizeLabelFr,
        })
        .from(products)
        .orderBy(asc(products.sortOrder)),
    ])
    return { ...page, products: productRows }
  })

export const getAdminOrder = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .inputValidator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => {
    const detail = await getOrderDetail(db(), data.id)
    if (!detail) return null
    const s = await getSettings(db())
    return {
      ...detail,
      customerTemplate:
        detail.order.locale === 'ar' ? s.templates.customerAr : s.templates.customerFr,
      cooperativeName: detail.order.locale === 'ar' ? s.identity.nameAr : s.identity.nameFr,
    }
  })

/* --------------------------------------------------------------- mutating */

export const adminSetOrderStatus = createServerFn({ method: 'POST' })
  .middleware([adminMutation])
  .inputValidator(
    z.object({
      ids: z.array(z.uuid()).min(1).max(200),
      status: z.enum(ORDER_STATUSES),
      note: z.string().trim().max(500).optional(),
    }),
  )
  .handler(({ data, context }) =>
    setOrderStatus(
      db(),
      { adminId: context.session.admin.id, ip: context.ip },
      data.ids,
      data.status,
      data.note,
    ),
  )

export const adminUpdateOrder = createServerFn({ method: 'POST' })
  .middleware([adminMutation])
  .inputValidator(
    z.object({
      id: z.uuid(),
      internalNote: z.string().max(2000).nullable().optional(),
      deliveryFee: z.number().min(0).max(10_000).nullable().optional(),
      quantities: z.record(z.uuid(), z.number().int().min(0).max(999)).optional(),
    }),
  )
  .handler(({ data, context }) => {
    const { id, ...edit } = data
    return updateOrder(db(), { adminId: context.session.admin.id, ip: context.ip }, id, edit)
  })

/** Owners only. Soft delete: see softDeleteOrders. */
export const adminDeleteOrders = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(z.object({ ids: z.array(z.uuid()).min(1).max(200) }))
  .handler(({ data, context }) =>
    softDeleteOrders(db(), { adminId: context.session.admin.id, ip: context.ip }, data.ids),
  )

export const adminRestoreOrders = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(z.object({ ids: z.array(z.uuid()).min(1).max(200) }))
  .handler(({ data, context }) =>
    restoreOrders(db(), { adminId: context.session.admin.id, ip: context.ip }, data.ids),
  )

/* ------------------------------------------------- notifications, paid */

/** Polled by the admin layout every few seconds: unseen orders for the red notifications. */
export const getUnseenOrders = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .handler(() => unseenOrders(db()))

/** Opening an order (or "mark all as seen") turns its notification off. */
export const adminMarkOrdersSeen = createServerFn({ method: 'POST' })
  .middleware([adminMutation])
  .inputValidator(z.object({ ids: z.array(z.uuid()).min(1).max(200).optional() }))
  .handler(({ data }) => markOrdersSeen(db(), data.ids))

/** Cash received on delivery (or undo). Every admin can record it; it is audited. */
export const adminSetOrdersPaid = createServerFn({ method: 'POST' })
  .middleware([adminMutation])
  .inputValidator(z.object({ ids: z.array(z.uuid()).min(1).max(200), paid: z.boolean() }))
  .handler(({ data, context }) =>
    setOrdersPaid(db(), { adminId: context.session.admin.id, ip: context.ip }, data.ids, data.paid),
  )
