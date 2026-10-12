import { createContext, type ReactNode, useContext } from 'react'
import type { Chrome } from '~/server/chrome'

const SiteContext = createContext<Chrome | null>(null)

export function SiteProvider({ value, children }: { value: Chrome; children: ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

/** Settings-driven data for header, footer and every WhatsApp button. */
export function useSite(): Chrome {
  const value = useContext(SiteContext)
  if (!value) throw new Error('useSite() must be used inside <SiteProvider>')
  return value
}
