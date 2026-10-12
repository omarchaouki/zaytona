import { type MessageKey, useT } from '~/i18n'
import type { LandingData } from '~/server/landing'
import { ArchWindow } from '../ArchWindow'
import { Picture } from '../Picture'
import { SectionHeading } from './SectionHeading'

const PROCESS: Array<{ title: MessageKey; body: MessageKey }> = [
  { title: 'story.process1Title', body: 'story.process1Body' },
  { title: 'story.process2Title', body: 'story.process2Body' },
  { title: 'story.process3Title', body: 'story.process3Body' },
  { title: 'story.process4Title', body: 'story.process4Body' },
]

type StoryProps = {
  story: LandingData['content']['story']
  gallery: LandingData['gallery']
}

/** Full-bleed band: the grove photo drifts behind (parallax), the story sits on top. */
export function Story({ story, gallery }: StoryProps) {
  const t = useT()
  const body = story.body ?? t('story.body')
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean)

  return (
    <section
      aria-labelledby="story-title"
      className="relative isolate overflow-hidden bg-olive-950 text-limewash"
    >
      <div aria-hidden="true" className="parallax absolute inset-0 -z-10">
        <Picture
          image="grove-green"
          alt=""
          sizes="100vw"
          className="block h-full w-full"
          imgClassName="opacity-35"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-olive-950 via-olive-950/80 to-olive-950"
      />

      <div className="container-page section-y">
        <div className="grid items-start gap-g5 md:grid-cols-[1fr_1.618fr] md:gap-g5 lg:gap-g6 [&>*]:min-w-0">
          <div
            data-reveal
            className="mx-auto w-[61.8vw] max-w-[16rem] md:sticky md:top-24 md:w-full md:max-w-[20rem]"
          >
            <ArchWindow
              slides={[
                { image: 'olives-golden-hour', alt: t('story.imageAlt') },
                { image: 'oil-pour', alt: '' },
              ]}
              sizes="(min-width: 64rem) 20rem, (min-width: 48rem) 17rem, 60vw"
              traceColor="var(--color-oil-bright)"
            />
          </div>

          <div>
            <div data-reveal>
              <SectionHeading
                id="story-title"
                eyebrow={t('story.eyebrow')}
                title={story.title ?? t('story.title')}
                className="[&_h2]:text-limewash [&>p:first-child]:text-olive-400"
              />
              <div className="mt-6 max-w-[38rem] space-y-4 text-lede text-limewash/80">
                {paragraphs.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}
              </div>
            </div>

            <h3 data-reveal className="mt-g5 text-h3 text-oil-bright">
              {t('story.processTitle')}
            </h3>
            {/* A real sequence: a vertical thread on phones, a 2 × 2 grid from 640px. */}
            <ol className="relative mt-g3 grid gap-g2 sm:grid-cols-2 sm:gap-g3">
              <span
                aria-hidden="true"
                className="absolute inset-y-6 start-[1.375rem] w-px bg-gradient-to-b from-oil/70 via-olive-400/40 to-transparent sm:hidden"
              />
              {PROCESS.map((step, i) => (
                <li
                  key={step.title}
                  data-reveal="start"
                  style={{ '--d': `${i * 0.1}s` } as React.CSSProperties}
                  className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-g2 sm:block sm:rounded-card sm:border sm:border-limewash/10 sm:bg-limewash/[0.06] sm:p-g3 sm:backdrop-blur-sm sm:transition-colors sm:hover:border-olive-400/40 sm:hover:bg-limewash/[0.09]"
                >
                  <span
                    aria-hidden="true"
                    className="relative z-10 flex size-11 items-center justify-center rounded-full bg-olive-950 font-display text-xl font-bold text-oil-bright tabular-nums ring-2 ring-oil/50 sm:mb-g2"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 rounded-card border border-limewash/10 bg-limewash/[0.06] p-g2 sm:border-0 sm:bg-transparent sm:p-0">
                    <p className="font-bold text-limewash">{t(step.title)}</p>
                    <p className="mt-1.5 text-limewash/75">{t(step.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {gallery.length ? (
          <div className="mt-g6">
            <h3 data-reveal className="text-h3 text-limewash">
              {t('story.galleryTitle')}
            </h3>
            <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {gallery.map((g, i) => (
                <li
                  key={g.id}
                  data-reveal
                  style={{ '--d': `${(i % 4) * 0.1}s` } as React.CSSProperties}
                >
                  <figure>
                    <div className="kenburns aspect-square overflow-hidden rounded-card bg-olive-900">
                      <Picture
                        image={g.image}
                        alt={g.caption ?? ''}
                        sizes="(min-width: 48rem) 17rem, 45vw"
                      />
                    </div>
                    {g.caption ? (
                      <figcaption className="mt-2 text-sm text-limewash/70">{g.caption}</figcaption>
                    ) : null}
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
