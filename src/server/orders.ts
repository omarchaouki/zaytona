import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import type { Database } from '~/db/client'
import { orderEvents, orderItems, orders, products } from '~/db/schema'
import type { Locale } from '~/i18n/config'
import {
  computeTotals,
  formatOrderReference,
  type OrderSummary,
  orderInputSchema,
} from '~/lib/order'
import { keyedHash } from './crypto'
import { checkFormToken } from './form-token'
import { checkPow, type PowCheck } from './pow'
import { consumeRateLimit } from './rate-limit'
import { getSettings } from './settings'

/*
 * Order placement, independent of the HTTP layer so it can be tested on PGlite.
 * Prices always come from the database; the client only sends product ids
 * and quantities.
 */

export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000
export const LIMITS = {
  perIp: { max: 5, windowSeconds: 10 * 60 },
  perPhone: { max: 5, windowSeconds: 10 * 60 },
}

export type PlaceOrderContext = {
  ipHash: string | null
  userAgent: string | null
  now?: Date
  /** Verifies the optional Cloudflare Turnstile token; omitted when Turnstile is off. */
  verifyTurnstile?: (token: string | undefined) => Promise<boolean>
  /** Proof-of-work check; defaults to the real one (tests swap it out). */
  checkPow?: (payload: string | undefined) => Promise<PowCheck>
}

export type PlaceOrderResult =
  | { status: 'created'; reference: string; viewToken: string; summary: CreatedOrder }
  | { status: 'duplicate'; reference: string; minutesAgo: number }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  | { status: 'unavailable'; productIds: string[] }
  | { status: 'rate_limited' }
  | { status: 'rejected' }

export type CreatedOrder = OrderSummary & {
  id: string
  phoneE164: string
  address: string | null
  note: string | null
  locale: Locale
  subtotal: string
}

/** Unguessable token for the confirmation URL (references are sequential). */
export function orderViewToken(reference: string): string {
  return keyedHash(reference, 'order-view').slice(0, 24)
}

function firstRow<T>(result: unknown): T | undefined {
  // postgres-js returns an array of rows, PGlite returns { rows }.
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows
  return rows?.[0] as T | undefined
}

export async function placeOrder(
  db: Database,
  raw: unknown,
  ctx: PlaceOrderContext,
): Promise<PlaceOrderResult> {
  const now = ctx.now ?? new Date()
  const parsed = orderInputSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] ??= issue.message.startsWith('validation.')
        ? issue.message
        : 'validation.invalid'
    }
    return { status: 'invalid', fieldErrors }
  }
  const input = parsed.data

  // Bots: honeypot filled, or posted faster than a person can type.
  if (input.website) return { status: 'rejected' }
  if (checkFormToken(input.formToken, now.getTime()) !== 'ok') return { status: 'rejected' }
  if (ctx.verifyTurnstile && (await ctx.verifyTurnstile(input.turnstileToken)) === false) {
    return { status: 'rejected' }
  }
  const pow = ctx.checkPow ?? ((payload) => checkPow(db, payload))
  if ((await pow(input.altcha)) !== 'ok') return { status: 'rejected' }

  if (
    ctx.ipHash &&
    !(await consumeRateLimit(
      db,
      `order:ip:${ctx.ipHash}`,
      LIMITS.perIp.max,
      LIMITS.perIp.windowSeconds,
    ))
  ) {
    return { status: 'rate_limited' }
  }
  if (
    !(await consumeRateLimit(
      db,
      `order:phone:${keyedHash(input.phone, 'phone')}`,
      LIMITS.perPhone.max,
      LIMITS.perPhone.windowSeconds,
    ))
  ) {
    return { status: 'rate_limited' }
  }

  // Merge repeated lines for the same product.
  const quantities = new Map<string, number>()
  for (const item of input.items) {
    quantities.set(
      item.productId,
      Math.min(99, (quantities.get(item.productId) ?? 0) + item.quantity),
    )
  }
  const productIds = [...quantities.keys()]

  const rows = productIds.length
    ? await db.select().from(products).where(inArray(products.id, productIds))
    : []
  const unavailable = productIds.filter((id) => {
    const p = rows.find((r) => r.id === id)
    return !p?.isActive || p.stockStatus === 'out_of_stock'
  })
  if (unavailable.length) return { status: 'unavailable', productIds: unavailable }

  const settings = await getSettings(db)
  const { pricing } = settings
  // Custom litres: only while a price per litre is set and the option is on.
  if (input.customLiters !== undefined) {
    const allowed =
      pricing.customEnabled &&
      pricing.pricePerLiter !== null &&
      input.customLiters >= pricing.customMinLiters &&
      input.customLiters <= pricing.customMaxLiters
    if (!allowed)
      return { status: 'invalid', fieldErrors: { customLiters: 'validation.litersRange' } }
  }
  const ar = input.locale === 'ar'
  const lines: Array<{
    productId: string | null
    name: string
    unitPrice: number
    quantity: number
  }> = productIds.map((id) => {
    // biome-ignore lint/style/noNonNullAssertion: every id was found above
    const p = rows.find((r) => r.id === id)!
    const size = ar ? p.sizeLabelAr : p.sizeLabelFr
    return {
      productId: id,
      name: [ar ? p.nameAr : p.nameFr, size].filter(Boolean).join(' — '),
      unitPrice: Number.parseFloat(p.priceMad),
      quantity: quantities.get(id) ?? 1,
    }
  })
  if (input.customLiters !== undefined && pricing.pricePerLiter !== null) {
    // One line priced per litre: quantity = litres, unit price = price of a litre.
    lines.push({
      productId: null,
      name: ar ? 'زيت الزيتون — باللتر' : "Huile d'olive — au litre",
      unitPrice: pricing.pricePerLiter,
      quantity: input.customLiters,
    })
  }
  const totals = computeTotals(lines, settings.delivery)

  const outcome = await db.transaction(async (tx) => {
    // Serialise submissions from the same phone: two taps on "Send" (or two
    // tabs) arriving at the same moment would otherwise both pass the
    // duplicate check below. Released automatically at commit/rollback.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.phone}, 0))`)

    // Same phone ordering the same product within 10 minutes: warn instead of duplicating.
    if (!input.confirmDuplicate) {
      const [recent] = await tx
        .select({ reference: orders.reference, createdAt: orders.createdAt })
        .from(orders)
        .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.phoneE164, input.phone),
            isNull(orders.deletedAt),
            gt(orders.createdAt, new Date(now.getTime() - DUPLICATE_WINDOW_MS)),
            // Same offer again, or (for litres) any order from this phone just now.
            input.customLiters !== undefined || productIds.length === 0
              ? undefined
              : inArray(orderItems.productId, productIds),
          ),
        )
        .orderBy(desc(orders.createdAt))
        .limit(1)
      if (recent) return { kind: 'duplicate' as const, recent }
    }

    // nextval() is atomic: concurrent orders always get distinct numbers.
    const seq = firstRow<{ n: string | number }>(
      await tx.execute(sql`select nextval('order_number_seq') as n`),
    )
    const number = Number(seq?.n)
    if (!Number.isSafeInteger(number)) throw new Error('order_number_seq returned no value')
    const reference = formatOrderReference(number, now.getFullYear())
    const [order] = await tx
      .insert(orders)
      .values({
        number,
        reference,
        customerName: input.name,
        phoneE164: input.phone,
        city: input.city,
        address: input.address ?? null,
        note: input.note ?? null,
        subtotal: totals.subtotal.toFixed(2),
        deliveryFee: totals.deliveryFee === null ? null : totals.deliveryFee.toFixed(2),
        total: totals.total.toFixed(2),
        locale: input.locale,
        source: 'landing',
        attribution: input.attribution ?? null,
        ipHash: ctx.ipHash,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!order) throw new Error('order insert returned no row')
    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        productNameSnapshot: l.name,
        unitPriceSnapshot: l.unitPrice.toFixed(2),
        quantity: l.quantity,
      })),
    )
    await tx.insert(orderEvents).values({
      orderId: order.id,
      toStatus: 'new',
      note: 'placed on website',
      createdAt: now,
    })
    return { kind: 'created' as const, order }
  })

  if (outcome.kind === 'duplicate') {
    const minutesAgo = Math.max(
      1,
      Math.round((now.getTime() - outcome.recent.createdAt.getTime()) / 60_000),
    )
    return { status: 'duplicate', reference: outcome.recent.reference, minutesAgo }
  }

  const created = outcome.order
  return {
    status: 'created',
    reference: created.reference,
    viewToken: orderViewToken(created.reference),
    summary: {
      id: created.id,
      reference: created.reference,
      customerName: created.customerName,
      phoneE164: created.phoneE164,
      city: created.city,
      address: created.address,
      note: created.note,
      locale: created.locale,
      items: lines.map((l) => ({ name: l.name, quantity: l.quantity })),
      subtotal: created.subtotal,
      deliveryFee: created.deliveryFee,
      total: created.total,
    },
  }
}

const CONFIRMATION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Order summary for the confirmation page, only with the matching token. */
export async function getOrderConfirmation(
  db: Database,
  reference: string,
  token: string,
  now = new Date(),
) {
  if (token.length !== 24 || token !== orderViewToken(reference)) return null
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.reference, reference), isNull(orders.deletedAt)))
  if (!order || now.getTime() - order.createdAt.getTime() > CONFIRMATION_TTL_MS) return null
  const items = await db
    .select({ name: orderItems.productNameSnapshot, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
  return {
    reference: order.reference,
    customerName: order.customerName,
    city: order.city,
    items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    status: order.status,
  }
}

export type OrderConfirmation = NonNullable<Awaited<ReturnType<typeof getOrderConfirmation>>>
