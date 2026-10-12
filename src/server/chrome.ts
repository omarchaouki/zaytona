import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '~/db/client'
import { certifications } from '~/db/schema'
import type { Locale } from '~/i18n/config'
import { getSettings } from './settings'

/** Data shared by every public page: header, footer, WhatsApp buttons. */
export async function loadChrome(db: Database, locale: Locale) {
  const ar = locale === 'ar'
  const [s, onssaRows] = await Promise.all([
    getSettings(db),
    db
      .select({ number: certifications.number })
      .from(certifications)
      .where(and(eq(certifications.type, 'onssa'), eq(certifications.isPublic, true)))
      .orderBy(asc(certifications.sortOrder))
      .limit(1),
  ])
  return {
    /** Meta Pixel, only when the owner switched it on with an ID. */
    pixel:
      s.marketing.pixelEnabled && s.marketing.pixelId
        ? { id: s.marketing.pixelId, requireConsent: s.marketing.requireConsent }
        : null,
    whatsappNumber: s.whatsapp.number,
    greeting: ar ? s.templates.greetingAr : s.templates.greetingFr,
    name: ar ? s.identity.nameAr : s.identity.nameFr,
    legal: s.identity.showLegalIds
      ? { legalName: s.identity.legalName, ice: s.identity.ice, rc: s.identity.rc }
      : null,
    contact: {
      phones: s.contact.phones,
      email: s.contact.email,
      address: ar ? s.contact.addressAr : s.contact.addressFr,
      mapUrl: s.contact.mapUrl,
      mapEmbedUrl: s.contact.mapEmbedUrl,
      hours: ar ? s.contact.hoursAr : s.contact.hoursFr,
      responseTime: ar ? s.contact.responseTimeAr : s.contact.responseTimeFr,
      socials: s.contact.socials,
    },
    onssaNumber: onssaRows[0]?.number?.trim() || null,
  }
}

export type Chrome = Awaited<ReturnType<typeof loadChrome>>
