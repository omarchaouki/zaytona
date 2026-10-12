import { describe, expect, it } from 'vitest'
import { formatMad } from '~/lib/format'
import { fillTemplate, normalizeWhatsappNumber, whatsappLink } from '~/lib/whatsapp'

describe('formatMad', () => {
  it('uses Western digits in Arabic', () => {
    // Moroccan CLDR convention: "." groups thousands, "," marks decimals.
    expect(formatMad(1250, 'ar')).toBe('1.250 درهم')
    expect(formatMad('89.50', 'ar')).toBe('89,5 درهم')
    expect(formatMad(120, 'ar')).toBe('120 درهم')
    expect(formatMad(1250, 'ar')).not.toMatch(/[٠-٩]/)
  })

  it('uses the Moroccan French format and MAD', () => {
    expect(formatMad(1250.5, 'fr')).toBe('1.250,5 MAD')
  })
})

describe('WhatsApp helpers', () => {
  it.each([
    ['+212 6 12 34 56 78', '212612345678'],
    ['00212612345678', '212612345678'],
    ['0612345678', '212612345678'],
    ['+33 6 12 34 56 78', '33612345678'],
    ['12', null],
    ['', null],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeWhatsappNumber(input)).toBe(expected)
  })

  it('builds an encoded wa.me link', () => {
    expect(whatsappLink('212612345678', 'سلام & bonjour')).toBe(
      `https://wa.me/212612345678?text=${encodeURIComponent('سلام & bonjour')}`,
    )
    expect(whatsappLink('212612345678')).toBe('https://wa.me/212612345678')
  })

  it('fills templates and leaves unknown placeholders', () => {
    expect(
      fillTemplate('{name} — {reference} {missing}', {
        name: 'Amina',
        reference: 'OL-2026-000001',
      }),
    ).toBe('Amina — OL-2026-000001 {missing}')
  })
})
