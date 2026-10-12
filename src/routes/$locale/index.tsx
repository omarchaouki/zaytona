import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Benefits } from '~/components/landing/Benefits'
import { Faq } from '~/components/landing/Faq'
import { FinalCta } from '~/components/landing/FinalCta'
import { HERO_BACKGROUND, HERO_BACKGROUND_SIZES, Hero } from '~/components/landing/Hero'
import { HowItWorks } from '~/components/landing/HowItWorks'
import { OnssaSection } from '~/components/landing/OnssaSection'
import { OrderSection } from '~/components/landing/OrderSection'
import { Products } from '~/components/landing/Products'
import { Reasons } from '~/components/landing/Reasons'
import { Story } from '~/components/landing/Story'
import { TrustStrip } from '~/components/landing/TrustStrip'
import { WhyUs } from '~/components/landing/WhyUs'
import { MobileOrderBar } from '~/components/MobileOrderBar'
import { imagePreloadLink } from '~/components/Picture'
import { ReviewsSection } from '~/components/reviews/ReviewsSection'
import { landingJsonLd, serializeJsonLd } from '~/lib/jsonld'
import { alternateLinks, siteUrl } from '~/lib/site'
import type { Chrome } from '~/server/chrome'
import { getLandingData } from '~/server/functions/public'

const searchSchema = z.object({
  /** Product slug preselected in the order form (set by the product "Order" buttons). */
  product: z.string().max(120).optional().catch(undefined),
})

export const Route = createFileRoute('/$locale/')({
  validateSearch: searchSchema,
  loader: ({ params }) => getLandingData({ data: { locale: params.locale } }),
  staleTime: 30_000,
  head: ({ params, loaderData, matches }) => {
    // Parent (/$locale) loader data is present at runtime but not in this route's types.
    const chrome = (matches as ReadonlyArray<{ routeId: string; loaderData?: unknown }>).find(
      (m) => m.routeId === '/$locale',
    )?.loaderData as Chrome | undefined
    const jsonLd =
      loaderData && chrome
        ? landingJsonLd({ origin: siteUrl(), locale: params.locale, chrome, data: loaderData })
        : []
    return {
      links: [
        ...alternateLinks(params.locale, ''),
        imagePreloadLink(HERO_BACKGROUND, HERO_BACKGROUND_SIZES),
      ],
      meta: [
        { property: 'og:url', content: `${siteUrl()}/${params.locale}` },
        { property: 'og:image', content: `${siteUrl()}/images/og-${params.locale}.jpg` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
      ],
      scripts: jsonLd.map((entry) => ({
        type: 'application/ld+json',
        children: serializeJsonLd(entry),
      })),
    }
  },
  component: LandingPage,
})

function LandingPage() {
  const data = Route.useLoaderData()
  const { product } = Route.useSearch()
  return (
    <>
      <Hero
        content={data.content.hero}
        rating={data.reviews?.realSummary ?? null}
        price={{ from: fromPrice(data.products), perLiter: data.settings.pricing.pricePerLiter }}
      />
      <TrustStrip />
      <Products products={data.products} pricing={data.settings.pricing} />
      {/* Why olive oil at all, before why ours. */}
      <Benefits />
      {/* The hook right after the products: why this oil and not another. */}
      <Reasons onssa={data.onssa} reviews={data.reviews} hasLabReports={data.hasLabReports} />
      {/* The proof behind the first reason: the ONSSA authorisation, on its own page-like band. */}
      <OnssaSection cert={data.onssa} />
      {data.reviews ? (
        <ReviewsSection data={data.reviews} formToken={data.order.formToken} />
      ) : null}
      <WhyUs
        onssa={data.onssa}
        certifications={data.certifications}
        stats={data.stats}
        content={data.content}
        delivery={data.settings.delivery}
      />
      <HowItWorks />
      <Story story={data.content.story} gallery={data.gallery} />
      <OrderSection
        products={data.products}
        delivery={data.settings.delivery}
        order={data.order}
        selectedProduct={product ?? null}
        pricing={data.settings.pricing}
      />
      <Faq faqs={data.faqs} />
      <FinalCta />
      <MobileOrderBar />
    </>
  )
}

/** Cheapest offer that can be ordered (the hero's "from …" price). */
function fromPrice(products: Array<{ price: string; stockStatus: string }>) {
  const prices = products
    .filter((p) => p.stockStatus !== 'out_of_stock')
    .map((p) => Number.parseFloat(p.price))
    .filter((n) => Number.isFinite(n) && n > 0)
  return prices.length ? Math.min(...prices) : null
}
