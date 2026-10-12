import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { Database } from '~/db/client'
import {
  certifications,
  faqs,
  galleryImages,
  orders,
  productImages,
  productLabReports,
  products,
} from '~/db/schema'
import type { Locale } from '~/i18n/config'
import { fileUrl, type ImageSources, resolveImage } from '~/lib/images'
import { listApprovedReviews, reviewSummary } from './reviews'
import { sanitizeRichText } from './sanitize'
import { getContent, getSettings } from './settings'

/*
 * Everything the public landing page needs, already localised, in one call.
 * Kept free of request context so integration tests can call it with PGlite.
 */

export type LandingProduct = {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  sizeLabel: string | null
  price: string
  /** Volume of an olive-oil offer, for the price-per-litre line. */
  liters: number | null
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
  isDemo: boolean
  image: ImageSources | null
  imageAlt: string
  labReport: { url: string; labName: string | null; analysedAt: string | null } | null
}

export type LandingCertification = {
  id: string
  type: 'onssa' | 'organic' | 'igp' | 'iso' | 'other'
  label: string | null
  number: string
  issuedAt: string | null
  expiresAt: string | null
  image: ImageSources | null
}

export type LandingData = Awaited<ReturnType<typeof loadLanding>>

export async function loadLanding(db: Database, locale: Locale) {
  const ar = locale === 'ar'
  const pick = <T>(a: T, f: T) => (ar ? a : f)

  const [settings, content, productRows, certRows, faqRows, galleryRows] = await Promise.all([
    getSettings(db),
    getContent(db, ['hero', 'story', 'policies'], locale),
    db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.sortOrder), asc(products.createdAt)),
    db
      .select()
      .from(certifications)
      .where(eq(certifications.isPublic, true))
      .orderBy(asc(certifications.sortOrder)),
    db
      .select()
      .from(faqs)
      .where(eq(faqs.isActive, true))
      .orderBy(asc(faqs.sortOrder), asc(faqs.createdAt)),
    db.select().from(galleryImages).orderBy(asc(galleryImages.sortOrder)),
  ])

  const productIds = productRows.map((p) => p.id)
  const [imageRows, reportRows] = productIds.length
    ? await Promise.all([
        db
          .select()
          .from(productImages)
          .where(inArray(productImages.productId, productIds))
          .orderBy(asc(productImages.sortOrder)),
        db
          .select()
          .from(productLabReports)
          .where(
            and(
              inArray(productLabReports.productId, productIds),
              eq(productLabReports.isPublic, true),
            ),
          )
          .orderBy(desc(productLabReports.analysedAt)),
      ])
    : [[], []]

  const productsOut: LandingProduct[] = productRows.map((p) => {
    const img = imageRows.find((i) => i.productId === p.id)
    const report = reportRows.find((r) => r.productId === p.id)
    const reportUrl = report ? fileUrl(report.fileUrl) : null
    const name = pick(p.nameAr, p.nameFr)
    return {
      id: p.id,
      slug: p.slug,
      name,
      tagline: pick(p.taglineAr, p.taglineFr),
      description: pick(p.descriptionAr, p.descriptionFr),
      sizeLabel: pick(p.sizeLabelAr, p.sizeLabelFr),
      price: p.priceMad,
      liters: p.liters === null ? null : Number(p.liters),
      stockStatus: p.stockStatus,
      isDemo: p.isDemo,
      image: img ? resolveImage(img.url, img) : null,
      imageAlt: (img && pick(img.altAr, img.altFr)) || name,
      labReport:
        report && reportUrl
          ? { url: reportUrl, labName: report.labName, analysedAt: report.analysedAt }
          : null,
    }
  })

  const certsOut: LandingCertification[] = certRows.map((c) => ({
    id: c.id,
    type: c.type,
    label: pick(c.labelAr, c.labelFr),
    number: c.number,
    issuedAt: c.issuedAt,
    expiresAt: c.expiresAt,
    image: c.imageUrl ? resolveImage(c.imageUrl) : null,
  }))
  // The public ONSSA authorisation entered in Admin → Certificates (the scan is optional).
  const onssa = certsOut.find((c) => c.type === 'onssa' && c.number.trim()) ?? null

  const deliveredOrders = settings.toggles.showCounters
    ? ((
        await db
          .select({ n: count() })
          .from(orders)
          .where(and(eq(orders.status, 'delivered'), isNull(orders.deletedAt)))
      )[0]?.n ?? 0)
    : 0

  // Reviews: approved only. The section still renders when there are none
  // ("be the first"), unless the admin switched it off.
  const reviewsData = settings.toggles.showReviews
    ? await Promise.all([
        reviewSummary(db),
        reviewSummary(db, { realOnly: true }),
        listApprovedReviews(db, locale),
      ]).then(([summary, realSummary, first]) => ({
        /** Everything shown in the reviews section (example reviews carry a badge). */
        summary,
        /** Customers only: hero rating, "why us" card and structured data. */
        realSummary,
        ...first,
      }))
    : null

  const { identity, contact, delivery, toggles, templates, pricing } = settings

  return {
    locale,
    settings: {
      whatsappNumber: settings.whatsapp.number,
      greeting: pick(templates.greetingAr, templates.greetingFr),
      identity: {
        name: pick(identity.nameAr, identity.nameFr),
        legalName: identity.showLegalIds ? identity.legalName : null,
        ice: identity.showLegalIds ? identity.ice : null,
        rc: identity.showLegalIds ? identity.rc : null,
      },
      contact: {
        phones: contact.phones,
        email: contact.email,
        address: pick(contact.addressAr, contact.addressFr),
        mapUrl: contact.mapUrl,
        mapEmbedUrl: contact.mapEmbedUrl,
        hours: pick(contact.hoursAr, contact.hoursFr),
        responseTime: pick(contact.responseTimeAr, contact.responseTimeFr),
        socials: contact.socials,
      },
      delivery: {
        mode: delivery.mode,
        fee: delivery.fee,
        freeAbove: delivery.freeAbove,
        time: pick(delivery.timeAr, delivery.timeFr),
      },
      toggles,
      pricing: {
        pricePerLiter: pricing.pricePerLiter,
        isDemo: pricing.isDemo,
        /** "Other quantity" in litres; null while off or without a price per litre. */
        custom:
          pricing.customEnabled && pricing.pricePerLiter !== null
            ? { min: pricing.customMinLiters, max: pricing.customMaxLiters }
            : null,
      },
    },
    content: {
      hero: content.hero,
      story: { ...content.story, body: content.story.body ?? null },
      policies: content.policies,
    },
    products: productsOut,
    certifications: certsOut,
    onssa,
    faqs: faqRows.map((f) => ({
      id: f.id,
      question: pick(f.questionAr, f.questionFr),
      answer: sanitizeRichText(pick(f.answerAr, f.answerFr)),
    })),
    gallery: toggles.showGallery
      ? galleryRows.flatMap((g) => {
          const image = resolveImage(g.url, g)
          return image ? [{ id: g.id, image, caption: pick(g.captionAr, g.captionFr) }] : []
        })
      : [],
    stats: { deliveredOrders: deliveredOrders > 0 ? deliveredOrders : null },
    reviews: reviewsData,
    hasLabReports: reportRows.length > 0,
  }
}
