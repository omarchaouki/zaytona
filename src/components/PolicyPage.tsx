import { Link } from '@tanstack/react-router'
import { useLocale, useT } from '~/i18n'

type PolicyPageProps = { title: string; html: string | null }

export function PolicyPage({ title, html }: PolicyPageProps) {
  const t = useT()
  const locale = useLocale()
  return (
    <article className="container-page max-w-3xl py-14 md:py-20">
      <h1 className="text-h2">{title}</h1>
      {html ? (
        <div
          className="rich-text mt-8 text-ink"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised server-side
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="mt-8 text-ink-soft">{t('policy.notPublished')}</p>
      )}
      <Link
        to="/$locale"
        params={{ locale }}
        className="tap mt-12 inline-flex items-center font-medium text-olive underline decoration-oil decoration-2 underline-offset-4"
      >
        {t('policy.backHome')}
      </Link>
    </article>
  )
}
