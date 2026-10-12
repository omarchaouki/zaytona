import type { ReactNode } from 'react'
import { cn } from '~/lib/cn'

type SectionHeadingProps = {
  id: string
  eyebrow?: string
  title: string
  intro?: ReactNode
  className?: string
}

export function SectionHeading({ id, eyebrow, title, intro, className }: SectionHeadingProps) {
  return (
    <div className={cn('max-w-[38.2rem]', className)}>
      {eyebrow ? <p className="mb-g1 text-sm font-medium text-leaf">{eyebrow}</p> : null}
      <h2 id={id} className="text-h2">
        {title}
      </h2>
      {intro ? <p className="mt-g2 text-lede text-ink-soft">{intro}</p> : null}
    </div>
  )
}
