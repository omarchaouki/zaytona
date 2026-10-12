import { Banknote, Leaf, ShieldCheck, Sprout, Truck } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { useT } from '~/i18n'

type Item = { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }

/**
 * Gold band with the trust promises scrolling past like a ticker. The list
 * is rendered twice for a seamless loop; the copy is hidden from assistive
 * tech. Pauses on hover/focus; static and wrapped under reduced motion.
 */
export function TrustStrip() {
  const t = useT()
  const items: Item[] = [
    { label: t('trust.onssa'), Icon: ShieldCheck },
    { label: t('trust.natural'), Icon: Leaf },
    { label: t('trust.direct'), Icon: Sprout },
    { label: t('trust.cod'), Icon: Banknote },
    { label: t('trust.delivery'), Icon: Truck },
  ]

  const list = (copy: boolean) => (
    <ul aria-hidden={copy || undefined} className="flex shrink-0 items-center gap-10 pe-10">
      {items.map(({ label, Icon }) => (
        <li
          key={label}
          className="flex items-center gap-2.5 whitespace-nowrap text-[0.9375rem] font-bold text-olive-950"
        >
          <Icon className="size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
          {label}
          <span aria-hidden="true" className="ms-8 text-olive-950/40">
            ✦
          </span>
        </li>
      ))}
    </ul>
  )

  return (
    <section aria-label={t('trust.label')} className="relative z-10 bg-oil py-4 shadow-lift">
      <div className="marquee">
        <div className="marquee-track">
          {list(false)}
          {list(true)}
        </div>
      </div>
    </section>
  )
}
