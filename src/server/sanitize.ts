import sanitizeHtml from 'sanitize-html'

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'ul',
    'ol',
    'li',
    'a',
    'h2',
    'h3',
    'blockquote',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Admin-authored rich text → safe HTML. Plain text (no tags) becomes paragraphs,
 * one per blank-line-separated block, with single newlines kept as <br>.
 */
export function sanitizeRichText(input: string): string {
  if (!/<[a-z!/]/i.test(input)) {
    return input
      .trim()
      .split(/\n\s*\n/)
      .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`)
      .join('')
  }
  return sanitizeHtml(input, OPTIONS)
}
