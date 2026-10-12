import { describe, expect, it } from 'vitest'
import ar from '~/i18n/ar.json'
import fr from '~/i18n/fr.json'
import { type MessageKey, translate } from '~/i18n/messages'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
  )
}

const allKeys = keys(ar) as MessageKey[]

describe('translation files', () => {
  it('have identical keys', () => {
    expect(keys(fr).sort()).toEqual(keys(ar).sort())
  })

  it('have no empty strings', () => {
    for (const locale of ['ar', 'fr'] as const) {
      expect(allKeys.filter((k) => translate(locale, k).trim() === '')).toEqual([])
    }
  })

  it('use matching {placeholders} in both languages', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const key of allKeys) {
      expect(placeholders(translate('fr', key)), key).toEqual(placeholders(translate('ar', key)))
    }
  })
})

describe('translate', () => {
  it('returns the string for the locale', () => {
    expect(translate('fr', 'nav.orderNow')).toBe('Commander')
    expect(translate('ar', 'nav.orderNow')).toBe('اطلب الآن')
  })
})
