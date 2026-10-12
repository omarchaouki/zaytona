import { describe, expect, it } from 'vitest'
import { formatMoroccanPhone, moroccanPhoneSchema, normalizeMoroccanPhone } from '~/lib/phone'

describe('normalizeMoroccanPhone', () => {
  it.each([
    ['0612345678', '+212612345678'],
    ['06 12 34 56 78', '+212612345678'],
    ['06.12.34.56.78', '+212612345678'],
    ['06-12-34-56-78', '+212612345678'],
    ['+212612345678', '+212612345678'],
    ['+212 6 12 34 56 78', '+212612345678'],
    ['00212712345678', '+212712345678'],
    ['0522123456', '+212522123456'],
    ['٠٦١٢٣٤٥٦٧٨', '+212612345678'],
    ['۰۶۱۲۳۴۵۶۷۸', '+212612345678'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeMoroccanPhone(input)).toBe(expected)
  })

  it.each([
    '0812345678', // 8 is not a valid leading digit
    '061234567', // too short
    '06123456789', // too long
    '+33612345678', // French number
    '212612345678', // missing + or 00
    'abc',
    '',
  ])('rejects %s', (input) => {
    expect(normalizeMoroccanPhone(input)).toBeNull()
  })
})

describe('moroccanPhoneSchema', () => {
  it('returns E.164 on success', () => {
    expect(moroccanPhoneSchema.parse(' 0612345678 ')).toBe('+212612345678')
  })

  it('reports i18n keys on failure', () => {
    const empty = moroccanPhoneSchema.safeParse('')
    expect(empty.success).toBe(false)
    expect(empty.error?.issues[0]?.message).toBe('validation.phoneRequired')

    const bad = moroccanPhoneSchema.safeParse('0812345678')
    expect(bad.error?.issues[0]?.message).toBe('validation.phoneInvalid')
  })
})

describe('formatMoroccanPhone', () => {
  it('formats for display', () => {
    expect(formatMoroccanPhone('+212612345678')).toBe('06 12 34 56 78')
  })
})
