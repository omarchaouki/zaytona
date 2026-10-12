import { useEffect } from 'react'
import { captureAttribution } from '~/lib/attribution'

/** Remembers the ad that brought the visitor (utm_* / fbclid), see lib/attribution. */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution(window.location.search)
  }, [])
  return null
}
