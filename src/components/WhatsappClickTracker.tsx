import { useEffect } from 'react'
import { useLocale } from '~/i18n'

/** One delegated listener: counts clicks on any [data-wa-placement] link (no personal data). */
export function WhatsappClickTracker() {
  const locale = useLocale()
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest<HTMLElement>('[data-wa-placement]')
      if (!link) return
      const body = JSON.stringify({ placement: link.dataset.waPlacement, locale })
      const blob = new Blob([body], { type: 'application/json' })
      if (!navigator.sendBeacon?.('/api/wa-click', blob)) {
        void fetch('/api/wa-click', {
          method: 'POST',
          body,
          keepalive: true,
          headers: { 'content-type': 'application/json' },
        }).catch(() => {})
      }
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [locale])
  return null
}
