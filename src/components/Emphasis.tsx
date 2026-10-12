import { Fragment } from 'react'

/**
 * Renders "plain *highlighted* plain": words between asterisks get the
 * emphasis style (gold on dark grounds). Works for admin-edited titles too.
 */
export function Emphasis({ text, className = 'text-gold' }: { text: string; className?: string }) {
  // Odd entries are the *highlighted* parts; keys use the text offset.
  let offset = 0
  const parts = text.split(/\*([^*]+)\*/g).map((part, i) => {
    const key = `${offset}:${part.length}`
    offset += part.length + (i % 2 === 1 ? 2 : 0)
    return { part, key, highlighted: i % 2 === 1 }
  })
  return (
    <>
      {parts.map(({ part, key, highlighted }) =>
        highlighted ? (
          <em key={key} className={`not-italic ${className}`}>
            {part}
          </em>
        ) : (
          <Fragment key={key}>{part}</Fragment>
        ),
      )}
    </>
  )
}

export const stripEmphasis = (text: string) => text.replace(/\*([^*]+)\*/g, '$1')
