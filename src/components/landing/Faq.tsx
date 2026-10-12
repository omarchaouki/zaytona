import { Plus } from 'lucide-react'
import { Accordion } from 'radix-ui'
import { useT } from '~/i18n'
import type { LandingData } from '~/server/landing'
import { SectionBackdrop } from '../SectionBackdrop'
import { WhatsappLink } from '../WhatsappLink'
import { SectionHeading } from './SectionHeading'

export function Faq({ faqs }: { faqs: LandingData['faqs'] }) {
  const t = useT()
  if (faqs.length === 0) return null

  return (
    <section aria-labelledby="faq-title" className="relative isolate">
      <SectionBackdrop image="olives-harvest" tone="light" position="50% 30%" />
      <div className="container-page section-y">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.618fr] lg:gap-g6">
          <div data-reveal>
            <SectionHeading id="faq-title" title={t('faq.title')} />
            <p className="mt-4 text-ink-soft">
              {t('faq.more')}{' '}
              <WhatsappLink
                placement="faq_more"
                className="inline-flex min-h-11 items-center font-medium text-olive underline decoration-oil decoration-2 underline-offset-4 hover:decoration-olive"
              >
                {t('faq.moreLink')}
              </WhatsappLink>
            </p>
          </div>

          <Accordion.Root type="single" collapsible className="border-t border-sand-deep">
            {faqs.map((f, i) => (
              <Accordion.Item
                key={f.id}
                value={f.id}
                data-reveal="start"
                style={{ '--d': `${Math.min(i, 8) * 0.05}s` } as React.CSSProperties}
                className="border-b border-sand-deep"
              >
                <Accordion.Header asChild>
                  <h3>
                    <Accordion.Trigger className="group flex min-h-14 w-full items-center justify-between gap-4 py-4 text-start text-[1.0625rem] font-medium text-olive">
                      {f.question}
                      <Plus
                        className="size-7 shrink-0 rounded-full bg-olive/5 p-1 text-olive-600 transition-[transform,background-color] duration-300 group-hover:bg-oil/30 group-data-[state=open]:rotate-45 group-data-[state=open]:bg-oil group-data-[state=open]:text-olive-950"
                        aria-hidden="true"
                      />
                    </Accordion.Trigger>
                  </h3>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden data-[state=closed]:animate-[accordion-up_200ms_ease-out] data-[state=open]:animate-[accordion-down_200ms_ease-out]">
                  <div
                    className="rich-text pb-5 text-ink-soft"
                    // Sanitised on the server (src/server/sanitize.ts).
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised server-side
                    dangerouslySetInnerHTML={{ __html: f.answer }}
                  />
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </div>
      </div>
    </section>
  )
}
