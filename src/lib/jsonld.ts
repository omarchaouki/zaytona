import type { Locale } from '~/i18n/config'
import type { Chrome } from '~/server/chrome'
import type { LandingData } from '~/server/landing'

/*
 * Structured data built only from real data: demo products are excluded,
 * and fields the client has not filled in are simply omitted.
 * AggregateRating/Review are added in milestone 6 from approved reviews only.
 */

type Json = Record<string, unknown>

export function landingJsonLd(args: {
  origin: string
  locale: Locale
  chrome: Chrome
  data: LandingData
}): Json[] {
  const { origin, locale, chrome, data } = args
  const pageUrl = `${origin}/${locale}`
  const orgId = `${origin}/#organization`

  const org: Json = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': orgId,
    name: chrome.name,
    url: pageUrl,
    image: `${origin}/images/olives-harvest-750.webp`,
    areaServed: { '@type': 'Country', name: 'Morocco' },
    paymentAccepted: 'Cash',
    currenciesAccepted: 'MAD',
  }
  if (chrome.legal?.legalName) org.legalName = chrome.legal.legalName
  if (chrome.contact.phones[0]) org.telephone = chrome.contact.phones[0]
  if (chrome.contact.email) org.email = chrome.contact.email
  if (chrome.contact.address) {
    org.address = {
      '@type': 'PostalAddress',
      streetAddress: chrome.contact.address,
      addressRegion: 'Marrakech-Safi',
      addressCountry: 'MA',
    }
  }
  if (chrome.contact.mapUrl) org.hasMap = chrome.contact.mapUrl
  const sameAs = Object.values(chrome.contact.socials).filter(Boolean)
  if (sameAs.length) org.sameAs = sameAs

  // Ratings: only from reviews the admin approved, and only when there are some.
  if (data.reviews && data.reviews.realSummary.count > 0) {
    org.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: data.reviews.realSummary.average,
      reviewCount: data.reviews.realSummary.count,
      bestRating: 5,
      worstRating: 1,
    }
    org.review = data.reviews.items
      .filter((r) => !r.isDemo)
      .slice(0, 5)
      .map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.name },
        datePublished: r.createdAt.slice(0, 10),
        reviewBody: r.comment,
        inLanguage: r.language,
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      }))
  }

  const products: Json[] = data.products
    .filter((p) => !p.isDemo)
    .map((p) => ({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: [p.name, p.sizeLabel].filter(Boolean).join(' — '),
      ...(p.tagline ? { description: p.tagline } : {}),
      ...(p.image ? { image: `${origin}${p.image.fallback}` } : {}),
      brand: { '@id': orgId },
      offers: {
        '@type': 'Offer',
        price: Number.parseFloat(p.price).toFixed(2),
        priceCurrency: 'MAD',
        availability:
          p.stockStatus === 'out_of_stock'
            ? 'https://schema.org/OutOfStock'
            : p.stockStatus === 'low_stock'
              ? 'https://schema.org/LimitedAvailability'
              : 'https://schema.org/InStock',
        url: `${pageUrl}?product=${encodeURIComponent(p.slug)}#order`,
        seller: { '@id': orgId },
      },
    }))

  const faq: Json[] = data.faqs.length
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: data.faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        },
      ]
    : []

  return [org, ...products, ...faq]
}

/** Serialise for a <script type="application/ld+json"> without breaking out of it. */
export function serializeJsonLd(value: unknown): string {
  // Escape '<' as a JSON unicode escape so the payload can never close the tag.
  return JSON.stringify(value).replace(
    /</g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}
