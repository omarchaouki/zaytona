import type { ComponentProps } from 'react'
import { whatsappLink } from '~/lib/whatsapp'
import type { WhatsappPlacement } from '~/lib/whatsapp-placements'
import { useSite } from './SiteContext'

type WhatsappLinkProps = Omit<ComponentProps<'a'>, 'href' | 'target' | 'rel'> & {
  placement: WhatsappPlacement
  /** Prefilled message; defaults to the greeting from settings. */
  text?: string
}

/**
 * Anchor to wa.me using the number from Settings. Renders nothing when no
 * number is configured, so a missing setting never produces a broken link.
 * Clicks are counted by <WhatsappClickTracker> through data-wa-placement.
 */
export function WhatsappLink({ placement, text, children, ...props }: WhatsappLinkProps) {
  const { whatsappNumber, greeting } = useSite()
  if (!whatsappNumber) return null
  return (
    <a
      {...props}
      href={whatsappLink(whatsappNumber, text ?? greeting)}
      target="_blank"
      rel="noopener noreferrer"
      data-wa-placement={placement}
    >
      {children}
    </a>
  )
}
