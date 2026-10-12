import { useRouterState } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useT } from '~/i18n'
import { WhatsappIcon } from './icons'
import { useSite } from './SiteContext'
import { WhatsappLink } from './WhatsappLink'

const TOOLTIP_KEY = 'wa-tooltip-seen'

/**
 * Fixed WhatsApp button, bottom-end (right in French, left in Arabic), from
 * tablets up. Phones already have WhatsApp in the sticky order bar, the hero
 * and the order section; a floating bubble there only covers the content.
 * Hidden entirely when no number is set in Settings.
 */
export function FloatingWhatsapp() {
  const t = useT()
  const { whatsappNumber } = useSite()
  const [tooltip, setTooltip] = useState(false)
  // The confirmation page has its own large WhatsApp button; don't stack a second one on it.
  const onConfirmation = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === '/$locale/order/$reference'),
  })

  useEffect(() => {
    if (!whatsappNumber || onConfirmation) return
    let seen = true
    try {
      seen = sessionStorage.getItem(TOOLTIP_KEY) === '1'
    } catch {}
    if (seen) return
    const show = window.setTimeout(() => {
      setTooltip(true)
      try {
        sessionStorage.setItem(TOOLTIP_KEY, '1')
      } catch {}
    }, 4000)
    const hide = window.setTimeout(() => setTooltip(false), 12_000)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
    }
  }, [whatsappNumber, onConfirmation])

  if (!whatsappNumber || onConfirmation) return null

  return (
    <div className="floating-wa fixed end-6 z-40 hidden flex-col items-end gap-2 md:flex">
      {tooltip ? (
        <div
          role="status"
          className="flex max-w-[15rem] items-start gap-2 rounded-card bg-limewash py-2.5 ps-3.5 pe-1.5 text-sm text-ink shadow-lift ring-1 ring-sand-deep"
        >
          <span className="pt-0.5">{t('whatsapp.tooltip')}</span>
          <button
            type="button"
            onClick={() => setTooltip(false)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-sand"
            aria-label={t('whatsapp.tooltipClose')}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <WhatsappLink
        placement="floating"
        aria-label={t('whatsapp.floatingLabel')}
        className="floating-wa-button flex size-14 items-center justify-center rounded-full bg-whatsapp text-whatsapp-ink shadow-lift ring-4 ring-limewash/70 transition-transform hover:scale-105"
      >
        <WhatsappIcon className="size-7" />
      </WhatsappLink>
    </div>
  )
}
