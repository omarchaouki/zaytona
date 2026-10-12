import { cn } from '~/lib/cn'

/*
 * Decorative olive branch in line art: the stem draws itself, leaves and
 * olives grow in one after another, then the whole branch sways gently.
 * Purely ornamental (aria-hidden); still under reduced motion.
 */

const STEM = 'M58 252 C 62 200, 40 160, 66 118 C 86 86, 76 50, 104 14'

// [x, y, rotation, length] along the stem, alternating sides.
const LEAVES: Array<[number, number, number, number]> = [
  [61, 222, -150, 46],
  [57, 196, -30, 44],
  [50, 168, -160, 48],
  [56, 140, -20, 46],
  [70, 112, -145, 44],
  [80, 88, -15, 42],
  [82, 64, -150, 40],
  [92, 40, -25, 38],
  [100, 22, -115, 30],
]

const OLIVES: Array<[number, number, string]> = [
  [44, 186, 'var(--color-olive-400)'],
  [36, 196, 'var(--color-olive-700)'],
  [88, 102, 'var(--color-olive-400)'],
  [74, 70, 'var(--color-oil)'],
]

const leafPath = (len: number) =>
  `M0 0 C ${len * 0.25} ${-len * 0.22}, ${len * 0.75} ${-len * 0.2}, ${len} 0 C ${len * 0.75} ${len * 0.2}, ${len * 0.25} ${len * 0.22}, 0 0 Z`

export function OliveBranch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 150 260"
      className={cn('pointer-events-none', className)}
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <g className="sway">
        <path
          d={STEM}
          pathLength={1}
          stroke="var(--color-oil)"
          strokeWidth={1.6}
          strokeLinecap="round"
          className="draw"
        />
        {LEAVES.map(([x, y, rot, len], i) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${rot})`}>
            <path
              d={leafPath(len)}
              fill="var(--color-olive-600)"
              fillOpacity={0.55}
              stroke="var(--color-olive-400)"
              strokeWidth={1}
              className="grow"
              style={{ '--d': `${0.5 + i * 0.16}s` } as React.CSSProperties}
            />
            <path
              d={`M2 0 L ${len - 4} 0`}
              stroke="var(--color-olive-200)"
              strokeOpacity={0.5}
              strokeWidth={0.6}
              className="grow"
              style={{ '--d': `${0.6 + i * 0.16}s` } as React.CSSProperties}
            />
          </g>
        ))}
        {OLIVES.map(([cx, cy, fill], i) => (
          <ellipse
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            rx={6.5}
            ry={8.5}
            fill={fill}
            className="grow"
            style={{ '--d': `${1.9 + i * 0.18}s` } as React.CSSProperties}
          />
        ))}
      </g>
    </svg>
  )
}
