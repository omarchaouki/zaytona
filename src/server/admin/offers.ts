import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '~/db/client'
import { auditLogs, orderItems, productImages, products, settings } from '~/db/schema'
import { litersPrice } from '~/lib/order'
import { parseSetting, settingsSchemas } from '~/lib/settings'
import type { Actor } from './orders'

/*
 * Olive-oil offers (30 L, 60 L, 90 L…) and the price per litre. An offer with
 * an automatic price costs liters × price per litre; its stored price is
 * recomputed whenever either changes, so the site, the order form and the
 * server always read one number (products.price_mad).
 */

export const pricingInput = settingsSchemas.pricing
  .omit({ isDemo: true })
  .extend({ pricePerLiter: z.number().min(0.01).max(100_000) })
  .refine((p) => p.customMinLiters <= p.customMaxLiters, { path: ['customMaxLiters'] })

export const offerInput = z
  .object({
    id: z.uuid().optional(),
    nameAr: z.string().trim().min(2).max(120),
    nameFr: z.string().trim().min(2).max(120),
    liters: z.number().positive().max(999),
    /** true: price = liters × price per litre. false: `price` below. */
    autoPrice: z.boolean(),
    price: z.number().min(0).max(1_000_000).optional(),
    taglineAr: z.string().trim().max(200).optional(),
    taglineFr: z.string().trim().max(200).optional(),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .refine((o) => o.autoPrice || o.price !== undefined, { path: ['price'] })

async function audit(db: Database, actor: Actor, action: string, entityId: string, meta: unknown) {
  await db.insert(auditLogs).values({
    adminId: actor.adminId,
    action,
    entity: 'product',
    entityId,
    meta: meta as Record<string, unknown>,
    ip: actor.ip,
  })
}

const sizeLabels = (liters: number) => {
  const n = Number.isInteger(liters) ? String(liters) : liters.toFixed(1)
  return { sizeLabelAr: `${n} لتر`, sizeLabelFr: `${n} litres` }
}

export async function listOffers(db: Database) {
  const [rows, [pricingRow]] = await Promise.all([
    db.select().from(products).orderBy(asc(products.sortOrder), asc(products.createdAt)),
    db.select().from(settings).where(eq(settings.key, 'pricing')),
  ])
  return {
    pricing: parseSetting('pricing', pricingRow?.value),
    offers: rows.map((p) => ({
      id: p.id,
      nameAr: p.nameAr,
      nameFr: p.nameFr,
      taglineAr: p.taglineAr,
      taglineFr: p.taglineFr,
      sizeLabelAr: p.sizeLabelAr,
      liters: p.liters === null ? null : Number(p.liters),
      autoPrice: p.autoPrice,
      price: Number(p.priceMad),
      isActive: p.isActive,
      isDemo: p.isDemo,
      sortOrder: p.sortOrder,
    })),
  }
}

/** Saves the price per litre and the "other quantity" limits; re-prices every automatic offer. */
export async function savePricing(
  db: Database,
  actor: Actor,
  input: z.output<typeof pricingInput>,
) {
  return db.transaction(async (tx) => {
    const value = { ...input, isDemo: false }
    await tx
      .insert(settings)
      .values({ key: 'pricing', value, updatedBy: actor.adminId })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedBy: actor.adminId, updatedAt: new Date() },
      })
    const auto = await tx
      .select({ id: products.id, liters: products.liters })
      .from(products)
      .where(eq(products.autoPrice, true))
    for (const o of auto) {
      if (o.liters === null) continue
      await tx
        .update(products)
        .set({ priceMad: litersPrice(Number(o.liters), input.pricePerLiter).toFixed(2) })
        .where(eq(products.id, o.id))
    }
    await audit(tx as unknown as Database, actor, 'pricing_update', 'pricing', input)
    return { ok: true as const, repriced: auto.length }
  })
}

export async function saveOffer(db: Database, actor: Actor, input: z.output<typeof offerInput>) {
  const [pricingRow] = await db.select().from(settings).where(eq(settings.key, 'pricing'))
  const { pricePerLiter } = parseSetting('pricing', pricingRow?.value)
  if (input.autoPrice && pricePerLiter === null)
    return { ok: false as const, error: 'no_price' as const }
  const price = input.autoPrice ? litersPrice(input.liters, pricePerLiter ?? 0) : (input.price ?? 0)
  const values = {
    nameAr: input.nameAr,
    nameFr: input.nameFr,
    taglineAr: input.taglineAr || null,
    taglineFr: input.taglineFr || null,
    liters: String(input.liters),
    autoPrice: input.autoPrice,
    priceMad: price.toFixed(2),
    isActive: input.isActive,
    ...sizeLabels(input.liters),
    // Saved by the cooperative: no longer an example.
    isDemo: false,
  }

  if (input.id) {
    const [row] = await db
      .update(products)
      .set({ ...values, ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }) })
      .where(eq(products.id, input.id))
      .returning({ id: products.id })
    if (!row) return { ok: false as const, error: 'not_found' as const }
    await audit(db, actor, 'offer_update', row.id, input)
    return { ok: true as const, id: row.id }
  }

  const slug = `huile-olive-${String(input.liters).replace('.', '-')}l-${Date.now().toString(36)}`
  const [row] = await db
    .insert(products)
    .values({ ...values, slug, sortOrder: input.sortOrder ?? 100 })
    .returning({ id: products.id })
  if (!row) throw new Error('offer insert returned no row')
  // Same photo as the seeded offers until a product photo upload exists.
  await db.insert(productImages).values({
    productId: row.id,
    url: 'static:oil-pour',
    altAr: 'زيت زيتون ذهبي يُسكب في وعاء',
    altFr: 'Huile d’olive dorée versée dans un bol',
  })
  await audit(db, actor, 'offer_create', row.id, input)
  return { ok: true as const, id: row.id }
}

/**
 * Removes an offer. Past orders keep their lines (name and price are copied
 * into each order), only the link to the offer is cleared.
 */
export async function deleteOffer(db: Database, actor: Actor, id: string) {
  const [used] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.productId, id))
    .limit(1)
  const [row] = await db.delete(products).where(eq(products.id, id)).returning({
    id: products.id,
    nameFr: products.nameFr,
    liters: products.liters,
  })
  if (!row) return { ok: false as const }
  await audit(db, actor, 'offer_delete', id, { ...row, hadOrders: Boolean(used) })
  return { ok: true as const }
}
