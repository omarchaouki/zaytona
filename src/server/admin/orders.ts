import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
  sql,
  sum,
} from 'drizzle-orm'
import type { Database } from '~/db/client'
import {
  admins,
  auditLogs,
  type OrderStatus,
  orderEvents,
  orderItems,
  orders,
  products,
  reviews,
  settings,
  whatsappClicks,
} from '~/db/schema'
import { type OrderFilters, pageSizeOf } from '~/lib/admin-orders'
import { normalizeMoroccanPhone } from '~/lib/phone'
import { parseSetting } from '~/lib/settings'

/* Admin order operations. Pure functions over a Database for testability. */

export type Actor = { adminId: string; ip: string | null }

function filterConditions(f: OrderFilters): SQL[] {
  const where: SQL[] = [isNull(orders.deletedAt)]
  if (f.status) where.push(eq(orders.status, f.status))
  if (f.paid === 'paid') where.push(isNotNull(orders.paidAt))
  if (f.paid === 'unpaid') where.push(isNull(orders.paidAt))
  if (f.unseen) where.push(isNull(orders.seenAt))
  if (f.city) where.push(ilike(orders.city, `%${f.city}%`))
  if (f.from) where.push(gte(orders.createdAt, new Date(`${f.from}T00:00:00`)))
  if (f.to)
    where.push(lt(orders.createdAt, new Date(new Date(`${f.to}T00:00:00`).getTime() + 86_400_000)))
  if (f.product) {
    where.push(
      inArray(
        orders.id,
        sql`(select ${orderItems.orderId} from ${orderItems} where ${orderItems.productId} = ${f.product})`,
      ),
    )
  }
  if (f.q) {
    const q = f.q.replace(/[%_]/g, '')
    const phone = normalizeMoroccanPhone(q)
    const digits = q.replace(/\D/g, '')
    const any: SQL[] = [ilike(orders.customerName, `%${q}%`), ilike(orders.reference, `%${q}%`)]
    if (phone) any.push(eq(orders.phoneE164, phone))
    else if (digits.length >= 4) any.push(ilike(orders.phoneE164, `%${digits.replace(/^0/, '')}%`))
    where.push(or(...any) as SQL)
  }
  return where
}

export async function listOrders(db: Database, f: OrderFilters) {
  const where = and(...filterConditions(f))
  const sortColumn = {
    createdAt: orders.createdAt,
    total: orders.total,
    customerName: orders.customerName,
    city: orders.city,
    status: orders.status,
  }[f.sort ?? 'createdAt']
  const order = (f.dir ?? 'desc') === 'asc' ? asc(sortColumn) : desc(sortColumn)
  const page = f.page ?? 1
  const pageSize = pageSizeOf(f)

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: orders.id,
        reference: orders.reference,
        createdAt: orders.createdAt,
        customerName: orders.customerName,
        phoneE164: orders.phoneE164,
        city: orders.city,
        total: orders.total,
        status: orders.status,
        locale: orders.locale,
        seenAt: orders.seenAt,
        paidAt: orders.paidAt,
        itemCount: sql<number>`(select coalesce(sum(${orderItems.quantity}), 0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
      })
      .from(orders)
      .where(where)
      .orderBy(order, desc(orders.number))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(orders).where(where),
  ])
  return { rows, total: totals?.n ?? 0, page, pageSize }
}

/** All matching orders (no paging) for CSV export, with their items. */
export async function exportOrders(db: Database, f: OrderFilters) {
  const rows = await db
    .select()
    .from(orders)
    .where(and(...filterConditions(f)))
    .orderBy(desc(orders.createdAt))
    .limit(20_000)
  const items = rows.length
    ? await db
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            rows.map((r) => r.id),
          ),
        )
    : []
  return rows.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }))
}

export async function getOrderDetail(db: Database, id: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
  if (!order) return null
  const [items, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
    db
      .select({
        id: orderEvents.id,
        fromStatus: orderEvents.fromStatus,
        toStatus: orderEvents.toStatus,
        note: orderEvents.note,
        createdAt: orderEvents.createdAt,
        adminEmail: admins.email,
      })
      .from(orderEvents)
      .leftJoin(admins, eq(admins.id, orderEvents.adminId))
      .where(eq(orderEvents.orderId, id))
      .orderBy(desc(orderEvents.createdAt)),
  ])
  return { order, items, events }
}

async function audit(
  db: Database,
  actor: Actor,
  action: string,
  entityId: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({
    adminId: actor.adminId,
    action,
    entity: 'order',
    entityId,
    meta: meta ?? null,
    ip: actor.ip,
  })
}

export async function setOrderStatus(
  db: Database,
  actor: Actor,
  ids: string[],
  status: OrderStatus,
  note?: string,
) {
  let changed = 0
  for (const id of ids) {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: orders.status })
        .from(orders)
        .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
        .for('update')
      if (!current || current.status === status) return
      await tx.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id))
      await tx.insert(orderEvents).values({
        orderId: id,
        adminId: actor.adminId,
        fromStatus: current.status,
        toStatus: status,
        note: note || null,
      })
      changed++
    })
    await audit(db, actor, 'order_status', id, { status, note: note || undefined })
  }
  return { changed }
}

export type OrderEdit = {
  internalNote?: string | null
  /** null = to be confirmed by phone. */
  deliveryFee?: number | null
  /** item id → new quantity (0 removes the line). */
  quantities?: Record<string, number>
}

/** Edit quantities, delivery fee and internal note; totals are recomputed. */
export async function updateOrder(db: Database, actor: Actor, id: string, edit: OrderEdit) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
      .for('update')
    if (!order) return { ok: false as const, reason: 'not_found' as const }

    if (edit.quantities) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
      const remaining = items.filter((i) => (edit.quantities?.[i.id] ?? i.quantity) > 0)
      if (remaining.length === 0) return { ok: false as const, reason: 'empty' as const }
      for (const item of items) {
        const q = edit.quantities[item.id]
        if (q === undefined || q === item.quantity) continue
        if (q <= 0) await tx.delete(orderItems).where(eq(orderItems.id, item.id))
        else
          await tx
            .update(orderItems)
            .set({ quantity: Math.min(q, 999) })
            .where(eq(orderItems.id, item.id))
      }
    }

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
    const subtotal = items.reduce((s, i) => s + Number(i.unitPriceSnapshot) * i.quantity, 0)
    const deliveryFee =
      edit.deliveryFee !== undefined
        ? edit.deliveryFee
        : order.deliveryFee === null
          ? null
          : Number(order.deliveryFee)
    const total = subtotal + (deliveryFee ?? 0)

    await tx
      .update(orders)
      .set({
        subtotal: subtotal.toFixed(2),
        deliveryFee: deliveryFee === null ? null : deliveryFee.toFixed(2),
        total: total.toFixed(2),
        internalNote:
          edit.internalNote !== undefined ? edit.internalNote || null : order.internalNote,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
    await tx
      .insert(orderEvents)
      .values({ orderId: id, adminId: actor.adminId, note: 'order edited' })
    await tx.insert(auditLogs).values({
      adminId: actor.adminId,
      action: 'order_edit',
      entity: 'order',
      entityId: id,
      meta: edit,
      ip: actor.ip,
    })
    return { ok: true as const }
  })
}

/**
 * "Delete" hides orders from every list, count and export; the rows stay for
 * the audit trail and can be restored (the dashboard offers an undo).
 */
export async function softDeleteOrders(db: Database, actor: Actor, ids: string[]) {
  const deleted = await db
    .update(orders)
    .set({ deletedAt: new Date() })
    .where(and(inArray(orders.id, ids), isNull(orders.deletedAt)))
    .returning({ id: orders.id })
  for (const { id } of deleted) await audit(db, actor, 'order_delete', id)
  return { deleted: deleted.length }
}

export async function restoreOrders(db: Database, actor: Actor, ids: string[]) {
  const restored = await db
    .update(orders)
    .set({ deletedAt: null })
    .where(and(inArray(orders.id, ids), isNotNull(orders.deletedAt)))
    .returning({ id: orders.id })
  for (const { id } of restored) await audit(db, actor, 'order_restore', id)
  return { restored: restored.length }
}

/* ------------------------------------------------------ seen and paid */

/** Orders no admin has opened yet (newest first), for the live notifications. */
export async function unseenOrders(db: Database, limit = 5) {
  const live = and(isNull(orders.deletedAt), isNull(orders.seenAt))
  const [latest, [total]] = await Promise.all([
    db
      .select({
        id: orders.id,
        reference: orders.reference,
        customerName: orders.customerName,
        city: orders.city,
        total: orders.total,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(live)
      .orderBy(desc(orders.createdAt))
      .limit(limit),
    db.select({ n: count() }).from(orders).where(live),
  ])
  return { count: total?.n ?? 0, latest }
}

/** Marks orders as seen (opened or acknowledged); `ids` omitted = every unseen order. */
export async function markOrdersSeen(db: Database, ids?: string[]) {
  const rows = await db
    .update(orders)
    .set({ seenAt: new Date() })
    .where(and(isNull(orders.seenAt), ids ? inArray(orders.id, ids) : undefined))
    .returning({ id: orders.id })
  return { marked: rows.length }
}

/** Records the cash as received (or undoes it), with an event on each order and an audit row. */
export async function setOrdersPaid(db: Database, actor: Actor, ids: string[], paid: boolean) {
  const now = new Date()
  const changed = await db
    .update(orders)
    .set(
      paid
        ? { paidAt: now, paidBy: actor.adminId, updatedAt: now }
        : { paidAt: null, paidBy: null, updatedAt: now },
    )
    .where(
      and(
        inArray(orders.id, ids),
        isNull(orders.deletedAt),
        paid ? isNull(orders.paidAt) : isNotNull(orders.paidAt),
      ),
    )
    .returning({ id: orders.id })
  for (const { id } of changed) {
    await db.insert(orderEvents).values({
      orderId: id,
      adminId: actor.adminId,
      note: paid ? 'marked paid' : 'payment cancelled',
    })
    await audit(db, actor, paid ? 'order_paid' : 'order_unpaid', id)
  }
  return { changed: changed.length }
}

/* ---------------------------------------------------------------- dashboard */

export async function dashboardStats(db: Database, now = new Date()) {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const since30 = new Date(startOfToday.getTime() - 29 * 86_400_000)
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1)
  const live = isNull(orders.deletedAt)

  const [
    [today],
    [pending],
    [toDeliver],
    [paidAll],
    [paidMonth],
    [unpaidDelivered],
    [all],
    [delivered],
    perDay,
    latest,
    [waClicks],
    settingRows,
    [demoProducts],
    [demoReviews],
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(orders)
      .where(and(live, gte(orders.createdAt, startOfToday))),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(live, eq(orders.status, 'new'))),
    db
      .select({ n: count(), amount: sum(orders.total) })
      .from(orders)
      .where(and(live, inArray(orders.status, ['confirmed', 'shipped']))),
    db
      .select({ n: count(), amount: sum(orders.total) })
      .from(orders)
      .where(and(live, isNotNull(orders.paidAt))),
    db
      .select({ n: count(), amount: sum(orders.total) })
      .from(orders)
      .where(and(live, gte(orders.paidAt, startOfMonth))),
    db
      .select({ n: count(), amount: sum(orders.total) })
      .from(orders)
      .where(and(live, eq(orders.status, 'delivered'), isNull(orders.paidAt))),
    db.select({ n: count() }).from(orders).where(live),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(live, eq(orders.status, 'delivered'))),
    db
      .select({
        day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
        n: count(),
      })
      .from(orders)
      .where(and(live, gte(orders.createdAt, since30)))
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`),
    db
      .select({
        id: orders.id,
        reference: orders.reference,
        customerName: orders.customerName,
        city: orders.city,
        total: orders.total,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(live)
      .orderBy(desc(orders.createdAt))
      .limit(6),
    db.select({ n: count() }).from(whatsappClicks).where(gte(whatsappClicks.createdAt, since30)),
    db
      .select()
      .from(settings)
      .where(inArray(settings.key, ['whatsapp', 'pricing'])),
    db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.isDemo, true), eq(products.isActive, true))),
    db.select({ n: count() }).from(reviews).where(eq(reviews.isDemo, true)),
  ])

  const byDay = new Map(perDay.map((d) => [d.day, d.n]))
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(since30.getTime() + i * 86_400_000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { day: key, count: byDay.get(key) ?? 0 }
  })
  const whatsapp = parseSetting('whatsapp', settingRows.find((r) => r.key === 'whatsapp')?.value)

  return {
    today: today?.n ?? 0,
    pending: pending?.n ?? 0,
    /** Cash received: all time, this calendar month, and delivered orders still unpaid. */
    paid: {
      count: paidAll?.n ?? 0,
      amount: Number(paidAll?.amount ?? 0),
      monthCount: paidMonth?.n ?? 0,
      monthAmount: Number(paidMonth?.amount ?? 0),
    },
    unpaidDelivered: {
      count: unpaidDelivered?.n ?? 0,
      amount: Number(unpaidDelivered?.amount ?? 0),
    },
    /** Confirmed or on the way: cash to collect on delivery. */
    toDeliver: {
      count: toDeliver?.n ?? 0,
      amount: Number(toDeliver?.amount ?? 0),
    },
    total: all?.n ?? 0,
    delivered: delivered?.n ?? 0,
    days,
    latest,
    whatsappClicks30: waClicks?.n ?? 0,
    warnings: {
      noWhatsapp: !whatsapp.number,
      demoProducts: demoProducts?.n ?? 0,
      demoReviews: demoReviews?.n ?? 0,
      demoPrice: parseSetting('pricing', settingRows.find((r) => r.key === 'pricing')?.value)
        .isDemo,
    },
  }
}
