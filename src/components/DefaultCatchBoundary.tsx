import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useT } from '~/i18n'
import { Button } from './ui/button'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const t = useT()
  const router = useRouter()
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="container-page flex min-h-[70dvh] flex-col items-start justify-center py-16">
      <h1 className="text-h2">{t('errors.genericTitle')}</h1>
      <p className="mt-4 max-w-[34rem] text-ink-soft">{t('errors.genericBody')}</p>
      <Button className="mt-8" onClick={() => router.invalidate()}>
        {t('errors.retry')}
      </Button>
    </main>
  )
}
