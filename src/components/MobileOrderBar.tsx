import { useEffect, useState } from 'react'
import { useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { WhatsappIcon } from './icons'
import { buttonVariants } from './ui/button'
import { WhatsappLink } from './WhatsappLink'

/**
 * Phone-only sticky bar (Order + WhatsApp). It appears once the hero buttons
 * have scrolled away and hides while the order section itself is on screen.
 * It toggles html[data-mobile-bar] so the floating WhatsApp button and the
 * footer make room for it (see --mobile-bar-h in app.css).
 */
export function MobileOrderBar() {
  const t = useT()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const heroCta = document.querySelector('[data-hero-cta]')
    const order = document.getElementById('order')
    if (!heroCta || !order) return
    let heroVisible = true
    let orderVisible = false
    const update = () => setVisible(!heroVisible && !orderVisible)
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === heroCta) heroVisible = entry.isIntersecting
        if (entry.target === order) orderVisible = entry.isIntersecting
      }
      update()
    })
    observer.observe(heroCta)
    observer.observe(order)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.mobileBar = visible ? 'on' : 'off'
    return () => {
      delete document.documentElement.dataset.mobileBar
    }
  }, [visible])

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-sand-deep bg-limewash/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 md:hidden',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
    >
      <div className="flex gap-3">
        <a href="#order" className={cn(buttonVariants(), 'flex-1')}>
          {t('mobileBar.order')}
        </a>
        <WhatsappLink
          placement="mobile_bar"
          className={cn(buttonVariants({ variant: 'outline' }), 'px-4')}
        >
          <WhatsappIcon className="text-whatsapp-deep" />
          {t('mobileBar.whatsapp')}
        </WhatsappLink>
      </div>
    </div>
  )
}
