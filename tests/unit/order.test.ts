import { describe, expect, it } from 'vitest'
import { normalizeForSearch, searchCities } from '~/lib/cities'
import { computeTotals, formatOrderReference, orderTemplateValues } from '~/lib/order'
import { checkFormToken, issueFormToken, MIN_FILL_MS } from '~/server/form-token'

const lines = [
  { unitPrice: 90, quantity: 2 },
  { unitPrice: 40.5, quantity: 1 },
]

describe('computeTotals', () => {
  it('leaves the fee open when delivery is confirmed by phone', () => {
    expect(computeTotals(lines, { mode: 'confirm', fee: null, freeAbove: null })).toEqual({
      subtotal: 220.5,
      deliveryFee: null,
      total: 220.5,
    })
  })

  it('adds a flat fee', () => {
    expect(computeTotals(lines, { mode: 'flat', fee: 35, freeAbove: null }).total).toBe(255.5)
  })

  it('makes delivery free from the threshold', () => {
    const rule = { mode: 'free_above' as const, fee: 30, freeAbove: 220.5 }
    expect(computeTotals(lines, rule).deliveryFee).toBe(0)
    expect(computeTotals([{ unitPrice: 90, quantity: 1 }], rule)).toEqual({
      subtotal: 90,
      deliveryFee: 30,
      total: 120,
    })
  })

  it('avoids floating point drift', () => {
    expect(
      computeTotals([{ unitPrice: 0.1, quantity: 3 }], {
        mode: 'confirm',
        fee: null,
        freeAbove: null,
      }).total,
    ).toBe(0.3)
  })
})

describe('order references and messages', () => {
  it('formats OL-YYYY-000123', () => {
    expect(formatOrderReference(123, 2026)).toBe('OL-2026-000123')
    expect(formatOrderReference(10001, 2026)).toBe('OL-2026-010001')
    expect(formatOrderReference(1234567, 2027)).toBe('OL-2027-1234567')
  })

  it('fills template values in the customer language', () => {
    const values = orderTemplateValues(
      {
        reference: 'OL-2026-000001',
        customerName: 'Amina',
        city: 'مراكش',
        items: [
          { name: 'زيت', quantity: 2 },
          { name: 'زيتون', quantity: 1 },
        ],
        total: '220.00',
        deliveryFee: null,
      },
      'ar',
    )
    expect(values.items).toBe('2 × زيت، 1 × زيتون')
    expect(values.total).toBe('220 درهم')
  })
})

describe('form token', () => {
  it('accepts a token after the minimum fill time', () => {
    const now = Date.now()
    expect(checkFormToken(issueFormToken(now - MIN_FILL_MS - 1), now)).toBe('ok')
    expect(checkFormToken(issueFormToken(now - 100), now)).toBe('too_fast')
    expect(checkFormToken(issueFormToken(now - 25 * 3600_000), now)).toBe('expired')
    expect(checkFormToken(`${now - 10_000}.abc`, now)).toBe('invalid')
    expect(checkFormToken('garbage', now)).toBe('invalid')
  })
})

describe('city search', () => {
  it('matches across languages, accents and Arabic spelling variants', () => {
    expect(searchCities('fes', 'fr')).toContain('Fès')
    expect(searchCities('فاس', 'fr')).toContain('Fès')
    expect(searchCities('kelaa', 'ar')).toContain('قلعة السراغنة')
    expect(searchCities('قلعه', 'ar')[0]).toBe('قلعة السراغنة')
    expect(searchCities('اكادير', 'ar')).toContain('أكادير')
    expect(searchCities('xyzxyz', 'fr')).toEqual([])
  })

  it('normalises text', () => {
    expect(normalizeForSearch('  Ksar-El-Kébir ')).toBe('ksar el kebir')
  })
})
