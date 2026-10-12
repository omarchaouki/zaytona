import { describe, expect, it } from 'vitest'
import { serializeJsonLd } from '~/lib/jsonld'
import { defaultSettings, parseSetting } from '~/lib/settings'
import { sanitizeRichText } from '~/server/sanitize'

describe('settings', () => {
  it('has safe defaults: no WhatsApp number, delivery confirmed by phone', () => {
    const s = defaultSettings()
    expect(s.whatsapp.number).toBeNull()
    expect(s.delivery.mode).toBe('confirm')
    expect(s.toggles.showCounters).toBe(false)
    expect(s.templates.orderAr).toContain('{reference}')
  })

  it('keeps valid fields and resets invalid ones', () => {
    const contact = parseSetting('contact', {
      email: 'not-an-email',
      hoursFr: 'Lun–Sam, 9h–18h',
      phones: ['+212612345678'],
    })
    expect(contact.email).toBeNull()
    expect(contact.hoursFr).toBe('Lun–Sam, 9h–18h')
    expect(contact.phones).toEqual(['+212612345678'])
  })

  it('rejects a malformed WhatsApp number', () => {
    expect(parseSetting('whatsapp', { number: '06 12' }).number).toBeNull()
    expect(parseSetting('whatsapp', { number: '212612345678' }).number).toBe('212612345678')
  })

  it('only accepts Google Maps embed URLs for the iframe', () => {
    expect(
      parseSetting('contact', { mapEmbedUrl: 'https://evil.example/x' }).mapEmbedUrl,
    ).toBeNull()
    const ok = 'https://www.google.com/maps/embed?pb=abc'
    expect(parseSetting('contact', { mapEmbedUrl: ok }).mapEmbedUrl).toBe(ok)
  })
})

describe('sanitizeRichText', () => {
  it('turns plain text into escaped paragraphs', () => {
    expect(sanitizeRichText('a < b\nline\n\nsecond')).toBe('<p>a &lt; b<br>line</p><p>second</p>')
  })

  it('strips scripts, handlers and javascript: links', () => {
    const out = sanitizeRichText(
      '<p onclick="x()">Hi<script>alert(1)</script> <a href="javascript:alert(1)">x</a> <a href="https://ok.ma">ok</a></p>',
    )
    expect(out).not.toMatch(/script|onclick|javascript:/)
    expect(out).toContain('href="https://ok.ma"')
    expect(out).toContain('rel="noopener noreferrer"')
  })
})

describe('serializeJsonLd', () => {
  it('cannot close the surrounding script tag', () => {
    expect(serializeJsonLd({ a: '</script><script>alert(1)</script>' })).not.toContain('</script>')
  })
})
