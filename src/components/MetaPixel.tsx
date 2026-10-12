import { useRouterState } from '@tanstack/react-router'
import { Cookie } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocale, useT } from '~/i18n'
import { type Consent, loadPixel, pixelTrack, readConsent, saveConsent } from '~/lib/meta-pixel'
import { useSite } from './SiteContext'
import { Button } from './ui/button'

/**
 * Loads the Meta Pixel on the public site when the owner enabled it. Without
 * the consent option it loads once the page is idle (never before the hero is
 * on screen); with it, only after the visitor taps "Accept" in a small bar.
 */
export function MetaPixel() {
  const pixel = useSite().pixel
  const [consent, setConsent] = useState<Consent | 'unknown'>('unknown')
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    setConsent(readConsent())
  }, [])

  const allowed = Boolean(pixel) && (!pixel?.requireConsent || consent === 'granted')

  useEffect(() => {
    if (!pixel || !allowed) return
    const load = () => loadPixel(pixel.id)
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(load, 1500)
    return () => clearTimeout(id)
  }, [pixel, allowed])

  // PageView when the visitor moves to another page (the first one is sent by
  // loadPixel). Only a change of path counts, not consent or re-renders.
  useEffect(() => {
    const previous = lastPath.current
    lastPath.current = pathname
    if (previous !== null && previous !== pathname && allowed) pixelTrack('PageView')
  }, [pathname, allowed])

  if (!pixel?.requireConsent || consent !== null) return null
  return (
    <ConsentBar
      onChoice={(value) => {
        saveConsent(value)
        setConsent(value)
      }}
    />
  )
}

function ConsentBar({ onChoice }: { onChoice: (value: 'granted' | 'denied') => void }) {
  const t = useT()
  const locale = useLocale()
  return (
    <section
      aria-label={t('consent.label')}
      className="notify-in fixed inset-x-3 bottom-3 z-50 rounded-card bg-olive-950/97 p-g2 text-limewash shadow-lift ring-1 ring-limewash/10 sm:inset-x-auto sm:end-4 sm:w-[24rem]"
    >
      <p className="flex items-start gap-2 text-sm">
        <Cookie className="mt-0.5 size-4 shrink-0 text-oil-bright" aria-hidden="true" />
        <span>
          {t('consent.body')}{' '}
          <a
            href={`/${locale}/privacy`}
            className="font-medium text-oil-bright underline underline-offset-2"
          >
            {t('consent.more')}
          </a>
        </span>
      </p>
      <div className="mt-g1 flex gap-2">
        <Button
          size="md"
          className="flex-1 bg-oil text-olive-950 hover:bg-oil-bright"
          onClick={() => onChoice('granted')}
        >
          {t('consent.accept')}
        </Button>
        <Button
          size="md"
          variant="ghost"
          className="flex-1 text-limewash hover:bg-limewash/10"
          onClick={() => onChoice('denied')}
        >
          {t('consent.decline')}
        </Button>
      </div>
    </section>
  )
}
