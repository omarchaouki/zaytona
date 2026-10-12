import { createFileRoute, Link } from '@tanstack/react-router'
import { Check, Copy, Phone, ShieldCheck, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { WhatsappIcon } from '~/components/icons'
import { useSite } from '~/components/SiteContext'
import { buttonVariants } from '~/components/ui/button'
import { WhatsappLink } from '~/components/WhatsappLink'
import { translate, useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatMad } from '~/lib/format'
import { trackLead } from '~/lib/meta-pixel'
import { ORDER_REFERENCE_RE, orderTemplateValues } from '~/lib/order'
import { fillTemplate } from '~/lib/whatsapp'
import { getOrderConfirmationFn } from '~/server/functions/orders'
import { getConfirmationSettings } from '~/server/functions/public'

export const Route = createFileRoute('/$locale/order/$reference')({
  validateSearch: z.object({ t: z.string().max(64).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ token: search.t ?? '' }),
  loader: async ({ params, deps }) => {
    const [order, settings] = await Promise.all([
      ORDER_REFERENCE_RE.test(params.reference) && deps.token
        ? getOrderConfirmationFn({ data: { reference: params.reference, token: deps.token } })
        : Promise.resolve(null),
      getConfirmationSettings({ data: { locale: params.locale } }),
    ])
    return { order, ...settings }
  },
  head: ({ params }) => ({
    meta: [
      { title: translate(params.locale, 'confirmation.metaTitle') },
      // Personal page: never indexed, never sent as a referrer.
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: ConfirmationPage,
})

function ConfirmationPage() {
  const { order, template } = Route.useLoaderData()
  const t = useT()
  const locale = useLocale()
  const { whatsappNumber, contact, pixel } = useSite()

  // Meta Pixel "Lead" for this order, once (only when the pixel is enabled).
  useEffect(() => {
    if (pixel && order) trackLead(order)
  }, [pixel, order])

  if (!order) {
    return (
      <div className="container-page max-w-2xl py-16 md:py-24">
        <h1 className="text-h2">{t('confirmation.notFoundTitle')}</h1>
        <p className="mt-4 text-ink-soft">{t('confirmation.notFoundBody')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/$locale" params={{ locale }} className={buttonVariants()}>
            {t('confirmation.backHome')}
          </Link>
          <WhatsappLink placement="confirmation" className={buttonVariants({ variant: 'outline' })}>
            <WhatsappIcon className="text-whatsapp-deep" />
            {t('faq.moreLink')}
          </WhatsappLink>
        </div>
      </div>
    )
  }

  const message = fillTemplate(template, orderTemplateValues(order, locale))
  const total = formatMad(order.total, locale)
  const firstName = order.customerName.split(/\s+/)[0] ?? order.customerName
  const phone = contact.phones[0]

  return (
    <div className="container-page max-w-2xl py-10 md:py-20">
      {/* Success: the check draws itself once (static under reduced motion). */}
      <div className="flex flex-col items-center text-center" data-reveal>
        <span className="relative flex size-20 items-center justify-center rounded-full bg-olive-600/10 ring-8 ring-olive-600/5">
          <svg viewBox="0 0 52 52" className="size-12 text-olive-600" aria-hidden="true">
            <circle
              cx="26"
              cy="26"
              r="23"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              pathLength={1}
              className="draw"
            />
            <path
              d="M15 27l7 7 15-16"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="draw"
              style={{ '--d': '0.5s' } as React.CSSProperties}
            />
          </svg>
        </span>
        <h1 className="mt-g3 text-h2">{t('confirmation.title', { name: firstName })}</h1>
        <p className="mt-g1 max-w-[30rem] text-lede text-ink-soft">
          {whatsappNumber ? t('confirmation.next') : t('confirmation.nextNoWhatsapp')}
        </p>
        <ReferenceTicket reference={order.reference} />
      </div>

      <div
        className="mt-g4 flex flex-col gap-3"
        data-reveal
        style={{ '--d': '0.15s' } as React.CSSProperties}
      >
        {whatsappNumber ? (
          <WhatsappLink
            placement="confirmation"
            text={message}
            className={cn(buttonVariants({ variant: 'whatsapp', size: 'lg' }), 'w-full')}
          >
            <WhatsappIcon />
            {t('confirmation.whatsapp')}
          </WhatsappLink>
        ) : null}
        {phone ? (
          <a
            href={`tel:${phone}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}
          >
            <Phone aria-hidden="true" />
            {t('order.byPhone')}
          </a>
        ) : null}
      </div>

      <section
        aria-labelledby="summary-title"
        data-reveal
        style={{ '--d': '0.3s' } as React.CSSProperties}
        className="mt-g4 rounded-[20px] bg-white/80 p-g3 shadow-lift ring-1 ring-sand-deep/60"
      >
        <h2 id="summary-title" className="text-h3">
          {t('confirmation.summary')}
        </h2>
        <ul className="mt-g2 space-y-2">
          {order.items.map((item) => (
            <li key={item.name} className="flex justify-between gap-4">
              <span className="min-w-0">{item.name}</span>
              <span className="shrink-0 font-medium tabular-nums" dir="ltr">
                × {item.quantity}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-g2 space-y-1.5 border-t border-sand-deep pt-g2 text-[0.9375rem]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">{t('confirmation.city')}</dt>
            <dd>{order.city}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">{t('orderForm.delivery')}</dt>
            <dd className="tabular-nums">
              {order.deliveryFee === null
                ? t('orderForm.deliveryConfirm')
                : Number(order.deliveryFee) === 0
                  ? t('orderForm.deliveryFree')
                  : formatMad(order.deliveryFee, locale)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-1">
            <dt className="font-bold text-olive">
              {order.deliveryFee === null
                ? t('orderForm.totalWithoutDelivery')
                : t('orderForm.total')}
            </dt>
            <dd className="font-display text-h3 text-olive tabular-nums">{total}</dd>
          </div>
        </dl>
        <p className="mt-g2 flex items-start gap-2 rounded-card bg-olive-600/[0.07] p-g2 text-olive">
          <Truck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {order.deliveryFee === null
            ? t('confirmation.payOnDeliveryTbc', { total })
            : t('confirmation.payOnDelivery', { total })}
        </p>
      </section>

      <p className="mt-g3 flex items-start gap-2 text-sm text-ink-soft">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-olive-600" aria-hidden="true" />
        {t('confirmation.keepReference')}
      </p>

      <Link
        to="/$locale"
        params={{ locale }}
        className="tap mt-g3 inline-flex items-center font-medium text-olive underline decoration-oil decoration-2 underline-offset-4"
      >
        {t('confirmation.backHome')}
      </Link>
    </div>
  )
}

/** The order number on a perforated "ticket", with a copy button. */
function ReferenceTicket({ reference }: { reference: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative mt-g3 flex w-full max-w-sm items-center justify-between gap-3 rounded-card border-2 border-dashed border-oil bg-limewash px-g2 py-3">
      <div className="min-w-0 text-start">
        <p className="text-sm text-ink-soft">{t('confirmation.referenceLabel')}</p>
        <p className="text-xl font-bold tracking-wide text-olive tabular-nums" dir="ltr">
          {reference}
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(reference)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
          } catch {
            // Clipboard blocked: the number stays selectable on screen.
          }
        }}
        className="tap inline-flex shrink-0 items-center gap-1.5 rounded-full border border-olive/25 px-3 text-sm font-medium text-olive hover:bg-olive/5"
      >
        {copied ? (
          <Check className="size-4 text-olive-600" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        <span aria-live="polite">{copied ? t('confirmation.copied') : t('confirmation.copy')}</span>
      </button>
    </div>
  )
}
