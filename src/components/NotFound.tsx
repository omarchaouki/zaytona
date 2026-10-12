import { Link } from '@tanstack/react-router'
import { useLocale, useT } from '~/i18n'
import { Button } from './ui/button'

export function NotFound() {
  const t = useT()
  const locale = useLocale()
  return (
    <main className="container-page flex min-h-[70dvh] flex-col items-start justify-center py-16">
      <h1 className="text-h2">{t('errors.notFoundTitle')}</h1>
      <p className="mt-4 max-w-[34rem] text-ink-soft">{t('errors.notFoundBody')}</p>
      <Button asChild className="mt-8">
        <Link to="/$locale" params={{ locale }}>
          {t('errors.backHome')}
        </Link>
      </Button>
    </main>
  )
}
