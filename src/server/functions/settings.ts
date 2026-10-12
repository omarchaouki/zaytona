import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '~/db/client'
import { auditLogs, settings } from '~/db/schema'
import { normalizeMoroccanPhone } from '~/lib/phone'
import { DELIVERY_CHOICES, deliveryFromChoice } from '~/lib/settings'
import { normalizeWhatsappNumber } from '~/lib/whatsapp'
import { adminAuth, ownerOnly } from '../auth/middleware'
import { getSettings } from '../settings'

/* Contact settings shown on the site: the WhatsApp number and the phone line. */

export const adminGetContactSettings = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .handler(async () => {
    const s = await getSettings(db())
    return { whatsapp: s.whatsapp.number, phone: s.contact.phones[0] ?? null }
  })

/**
 * Empty clears a value (an empty WhatsApp number hides every WhatsApp button).
 * Any common Moroccan or international format is accepted and normalised.
 */
export const adminSaveContactSettings = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(z.object({ whatsapp: z.string().max(40), phone: z.string().max(40) }))
  .handler(async ({ data, context }) => {
    const whatsapp = data.whatsapp.trim() ? normalizeWhatsappNumber(data.whatsapp) : null
    const phone = data.phone.trim() ? normalizeMoroccanPhone(data.phone) : null
    const errors: Record<string, 'invalid'> = {}
    if (data.whatsapp.trim() && !whatsapp) errors.whatsapp = 'invalid'
    if (data.phone.trim() && !phone) errors.phone = 'invalid'
    if (Object.keys(errors).length) return { ok: false as const, errors }

    const database = db()
    const current = await getSettings(database)
    const adminId = context.session.admin.id
    await database.transaction(async (tx) => {
      const upsert = (key: 'whatsapp' | 'contact', value: unknown) =>
        tx
          .insert(settings)
          .values({ key, value, updatedBy: adminId })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value, updatedBy: adminId, updatedAt: new Date() },
          })
      await upsert('whatsapp', { number: whatsapp })
      const others = current.contact.phones.slice(1)
      await upsert('contact', { ...current.contact, phones: phone ? [phone, ...others] : others })
      await tx.insert(auditLogs).values({
        adminId,
        action: 'contact_settings_update',
        entity: 'settings',
        entityId: 'whatsapp',
        meta: { whatsapp, phone },
        ip: context.ip,
      })
    })
    return { ok: true as const, whatsapp, phone }
  })

/* Delivery fees: what the order form adds to the total, and what the site says. */

export const adminGetDeliverySettings = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .handler(async () => (await getSettings(db())).delivery)

const deliveryInput = z.object({
  /** "free" is stored as a flat fee of 0. */
  choice: z.enum(DELIVERY_CHOICES),
  fee: z.number().min(0).max(10_000).optional(),
  freeAbove: z.number().min(0).max(1_000_000).optional(),
  timeAr: z.string().trim().max(200),
  timeFr: z.string().trim().max(200),
})

export const adminSaveDeliverySettings = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(deliveryInput)
  .handler(async ({ data, context }) => {
    const errors: Record<string, 'required'> = {}
    if ((data.choice === 'flat' || data.choice === 'free_above') && data.fee === undefined) {
      errors.fee = 'required'
    }
    if (data.choice === 'free_above' && data.freeAbove === undefined) errors.freeAbove = 'required'
    if (Object.keys(errors).length) return { ok: false as const, errors }

    const value = deliveryFromChoice(data)
    const adminId = context.session.admin.id
    await db().transaction(async (tx) => {
      await tx
        .insert(settings)
        .values({ key: 'delivery', value, updatedBy: adminId })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedBy: adminId, updatedAt: new Date() },
        })
      await tx.insert(auditLogs).values({
        adminId,
        action: 'delivery_settings_update',
        entity: 'settings',
        entityId: 'delivery',
        meta: value,
        ip: context.ip,
      })
    })
    return { ok: true as const }
  })

/* Marketing: the Meta (Facebook / Instagram) Pixel. Off until enabled here. */

export const adminGetMarketingSettings = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .handler(async () => (await getSettings(db())).marketing)

export const adminSaveMarketingSettings = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(
    z.object({
      pixelEnabled: z.boolean(),
      pixelId: z.string().trim().max(40),
      requireConsent: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    const pixelId = data.pixelId.replace(/\s/g, '')
    if (pixelId && !/^\d{8,20}$/.test(pixelId)) {
      return { ok: false as const, error: 'invalid_id' as const }
    }
    if (data.pixelEnabled && !pixelId) return { ok: false as const, error: 'missing_id' as const }
    const value = {
      pixelEnabled: data.pixelEnabled,
      pixelId: pixelId || null,
      requireConsent: data.requireConsent,
    }
    const adminId = context.session.admin.id
    await db().transaction(async (tx) => {
      await tx
        .insert(settings)
        .values({ key: 'marketing', value, updatedBy: adminId })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedBy: adminId, updatedAt: new Date() },
        })
      await tx.insert(auditLogs).values({
        adminId,
        action: 'marketing_settings_update',
        entity: 'settings',
        entityId: 'marketing',
        meta: value,
        ip: context.ip,
      })
    })
    return { ok: true as const }
  })
