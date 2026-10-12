import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/db/client'
import { auditLogs, certifications, certificationType } from '~/db/schema'
import { resolveImage } from '~/lib/images'
import { adminAuth, ownerOnly } from '../auth/middleware'
import { storeImage, UploadError } from '../storage'

/*
 * Certifications (ONSSA first): number, dates and the scanned certificate.
 * The public ONSSA badge appears only once a number AND a scan exist and the
 * certificate is marked public, so nothing unverifiable is ever shown.
 */

export const adminGetCertifications = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .handler(async () => {
    const rows = await db().select().from(certifications).orderBy(asc(certifications.sortOrder))
    return rows.map((c) => ({ ...c, image: c.imageUrl ? resolveImage(c.imageUrl) : null }))
  })

const fieldsSchema = z.object({
  id: z.uuid().optional(),
  type: z.enum(certificationType.enumValues),
  number: z.string().trim().min(2).max(80),
  labelAr: z.string().trim().max(120).optional(),
  labelFr: z.string().trim().max(120).optional(),
  issuedAt: z.iso
    .date()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  expiresAt: z.iso
    .date()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  isPublic: z.enum(['true', 'false']).transform((v) => v === 'true'),
})

/** Multipart: the fields above plus an optional `scan` image (replaces the current one). */
export const adminSaveCertification = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error('Expected multipart form data')
    return data
  })
  .handler(async ({ data, context }) => {
    const raw = Object.fromEntries(
      [...data.entries()].filter(([, v]) => typeof v === 'string'),
    ) as Record<string, string>
    const parsed = fieldsSchema.safeParse(raw)
    if (!parsed.success) return { ok: false as const, error: 'invalid' as const }
    const f = parsed.data

    let imageUrl: string | undefined
    const scan = data.get('scan')
    if (scan instanceof Blob && scan.size > 0) {
      try {
        const stored = await storeImage(new Uint8Array(await scan.arrayBuffer()))
        imageUrl = stored.key
      } catch (error) {
        if (error instanceof UploadError) return { ok: false as const, error: error.code }
        throw error
      }
    }

    const values = {
      type: f.type,
      number: f.number,
      labelAr: f.labelAr || null,
      labelFr: f.labelFr || null,
      issuedAt: f.issuedAt ?? null,
      expiresAt: f.expiresAt ?? null,
      isPublic: f.isPublic,
      ...(imageUrl ? { imageUrl } : {}),
    }
    const [row] = f.id
      ? await db().update(certifications).set(values).where(eq(certifications.id, f.id)).returning()
      : await db().insert(certifications).values(values).returning()
    await db()
      .insert(auditLogs)
      .values({
        adminId: context.session.admin.id,
        action: f.id ? 'certification_update' : 'certification_create',
        entity: 'certification',
        entityId: row?.id ?? null,
        meta: { type: f.type, number: f.number, newScan: Boolean(imageUrl) },
        ip: context.ip,
      })
    return { ok: true as const }
  })

export const adminDeleteCertification = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(z.object({ id: z.uuid() }))
  .handler(async ({ data, context }) => {
    await db().delete(certifications).where(eq(certifications.id, data.id))
    await db().insert(auditLogs).values({
      adminId: context.session.admin.id,
      action: 'certification_delete',
      entity: 'certification',
      entityId: data.id,
      ip: context.ip,
    })
    return { ok: true }
  })
