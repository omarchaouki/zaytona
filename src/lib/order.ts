import { z } from 'zod'
import { LOCALES, type Locale } from '~/i18n/config'
import { attributionSchema } from './attribution'
import { formatMad } from './format'
import { moroccanPhoneSchema } from './phone'
import type { Settings } from './settings'

/*
 * Order rules shared by the form (live validation, live total) and the
 * server (authoritative validation, pricing from the DB, never from the client).
 * Error messages are i18n keys under `validation.*`.
 */

export const MAX_QUANTITY = 99
export const MAX_LINES = 10

const optionalText = (max: number, key: string) =>
  z
    .string()
    .trim()
    .max(max, key)
    .optional()
    .transform((v) => (v ? v : undefined))

/** Plain-string versions of the optional fields, for the form's field validators. */
export const optionalFieldInputs = {
  address: z.string().trim().max(300, 'validation.addressTooLong'),
  note: z.string().trim().max(500, 'validation.noteTooLong'),
}

export const orderFields = {
  name: z.string().trim().min(2, 'validation.nameRequired').max(80, 'validation.nameTooLong'),
  phone: moroccanPhoneSchema,
  city: z.string().trim().min(2, 'validation.cityRequired').max(80, 'validation.cityTooLong'),
  address: optionalText(300, 'validation.addressTooLong'),
  note: optionalText(500, 'validation.noteTooLong'),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(MAX_QUANTITY),
      }),
    )
    .max(MAX_LINES, 'validation.itemsTooMany')
    .default([]),
  /** Olive oil by the litre, any amount within the limits set in Settings → pricing. */
  customLiters: z.number().int().min(1).max(999).optional(),
}

export const orderInputSchema = z
  .object({
    ...orderFields,
    locale: z.enum(LOCALES),
    /** Signed render timestamp (anti-bot minimum fill time). */
    formToken: z.string().max(200),
    /** Honeypot: hidden from people, bots fill it. */
    website: z.string().max(200).optional(),
    /** The visitor saw the duplicate warning and confirmed it is a new order. */
    confirmDuplicate: z.boolean().optional(),
    turnstileToken: z.string().max(4096).optional(),
    /** Proof-of-work solution (ALTCHA payload, base64). */
    altcha: z.string().max(4096).optional(),
    /** utm_* / fbclid of the visitor's first arrival (ads attribution). */
    attribution: attributionSchema.optional(),
  })
  // An offer or a number of litres. `when` runs it even if other fields failed,
  // so the visitor sees every error at once (the values may be unparsed here).
  .refine(
    (o) => (Array.isArray(o.items) && o.items.length > 0) || typeof o.customLiters === 'number',
    {
      path: ['items'],
      message: 'validation.itemsRequired',
      when: () => true,
    },
  )

export type OrderInput = z.input<typeof orderInputSchema>
export type ParsedOrderInput = z.output<typeof orderInputSchema>

/* ------------------------------------------------------------------ totals */

export type PricedLine = { unitPrice: number; quantity: number }

export type Totals = {
  subtotal: number
  /** null: the delivery fee is confirmed by phone. */
  deliveryFee: number | null
  total: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Price of `liters` of oil at `pricePerLiter` MAD, to the centime. */
export function litersPrice(liters: number, pricePerLiter: number): number {
  return round2(liters * pricePerLiter)
}

export function computeTotals(
  lines: PricedLine[],
  delivery: Pick<Settings['delivery'], 'mode' | 'fee' | 'freeAbove'>,
): Totals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0))
  let deliveryFee: number | null = null
  if (delivery.mode === 'flat' && delivery.fee !== null) deliveryFee = delivery.fee
  if (delivery.mode === 'free_above' && delivery.fee !== null) {
    deliveryFee = delivery.freeAbove !== null && subtotal >= delivery.freeAbove ? 0 : delivery.fee
  }
  return { subtotal, deliveryFee, total: round2(subtotal + (deliveryFee ?? 0)) }
}

/* -------------------------------------------------------------- reference */

/** 10001 in 2026 → OL-2026-010001 */
export function formatOrderReference(number: number, year: number): string {
  return `OL-${year}-${String(number).padStart(6, '0')}`
}

export const ORDER_REFERENCE_RE = /^OL-\d{4}-\d{6,}$/

/* -------------------------------------------------------- WhatsApp message */

export type OrderSummary = {
  reference: string
  customerName: string
  city: string
  items: Array<{ name: string; quantity: number }>
  total: string
  deliveryFee: string | null
}

/** Values for the {placeholders} of the admin-editable message templates. */
export function orderTemplateValues(order: OrderSummary, locale: Locale) {
  return {
    reference: order.reference,
    name: order.customerName,
    city: order.city,
    items: order.items.map((i) => `${i.quantity} × ${i.name}`).join(locale === 'ar' ? '، ' : ', '),
    total: formatMad(order.total, locale),
  }
}
