import { Phone } from 'lucide-react'
import { useT } from '~/i18n'
import { formatPhoneDisplay } from '~/lib/phone'
import type { LandingData } from '~/server/landing'
import { WhatsappIcon } from '../icons'
import { OrderForm } from '../order/OrderForm'
import { SectionBackdrop } from '../SectionBackdrop'
import { useSite } from '../SiteContext'
import { WhatsappLink } from '../WhatsappLink'
import { SectionHeading } from './SectionHeading'

type OrderSectionProps = {
  products: LandingData['products']
  delivery: LandingData['settings']['delivery']
  order: { formToken: string; turnstileSiteKey: string | null }
  selectedProduct: string | null
  pricing: LandingData['settings']['pricing']
}

/** Target of every "Order" button (#order): the form, plus WhatsApp/phone as alternatives. */
export function OrderSection({
  products,
  delivery,
  order,
  selectedProduct,
  pricing,
}: OrderSectionProps) {
  const t = useT()
  const { contact, whatsappNumber } = useSite()
  const phone = contact.phones[0]
  const altLink =
    'tap inline-flex items-center gap-2 font-medium text-limewash underline decoration-oil decoration-2 underline-offset-4 hover:decoration-limewash'

  return (
    <section
      id="order"
      aria-labelledby="order-title"
      className="relative isolate scroll-mt-16 border-t-4 border-oil bg-olive-950"
    >
      <SectionBackdrop image="grove-green" tone="dark" position="50% 60%" />
      {/* Phones: heading, form, then the alternatives. Desktop: heading + alternatives beside the form. */}
      <div className="container-page grid gap-g4 section-y lg:grid-cols-[1fr_1.618fr] lg:grid-rows-[auto_1fr] lg:gap-x-g5 lg:gap-y-0">
        <div data-reveal className="lg:col-start-1 lg:row-start-1 lg:pt-2">
          <SectionHeading
            id="order-title"
            eyebrow={t('order.eyebrow')}
            title={t('order.title')}
            intro={t('order.intro')}
            className="[&_h2]:text-limewash [&_p]:text-limewash/80 [&>p:first-child]:text-oil"
          />
        </div>

        <div
          data-reveal="scale"
          style={{ '--d': '0.12s' } as React.CSSProperties}
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <OrderForm
            products={products}
            delivery={delivery}
            formToken={order.formToken}
            turnstileSiteKey={order.turnstileSiteKey}
            selectedProduct={selectedProduct}
            pricing={pricing}
          />
        </div>

        {whatsappNumber || phone ? (
          <div className="lg:col-start-1 lg:row-start-2">
            <div className="border-t border-limewash/20 pt-6 lg:mt-10">
              <p className="font-medium text-limewash">{t('order.altTitle')}</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <WhatsappLink placement="order_section" className={altLink}>
                    <WhatsappIcon className="size-5 text-whatsapp" />
                    {t('order.byWhatsapp')}
                  </WhatsappLink>
                </li>
                {phone ? (
                  <li>
                    <a href={`tel:${phone}`} className={altLink}>
                      <Phone className="size-5 text-oil" aria-hidden="true" />
                      {t('order.byPhone')} · <span dir="ltr">{formatPhoneDisplay(phone)}</span>
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
