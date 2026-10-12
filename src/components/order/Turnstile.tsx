import { useEffect } from 'react'
import { useLocale } from '~/i18n'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

/**
 * Optional Cloudflare Turnstile (enabled when TURNSTILE_SITE_KEY is set).
 * The widget adds a hidden `cf-turnstile-response` input that the form reads.
 */
export function Turnstile({ siteKey }: { siteKey: string }) {
  const locale = useLocale()
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [])
  return (
    <div
      className="cf-turnstile mt-6"
      data-sitekey={siteKey}
      data-language={locale}
      data-size="flexible"
      data-appearance="interaction-only"
    />
  )
}
