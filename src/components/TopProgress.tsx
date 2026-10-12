import { useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { doneProgress, startProgress, trackServerFunctionPosts } from '~/lib/progress'

/** The Livewire-style loading line (see lib/progress.ts) for page changes and form posts. */
export function TopProgress() {
  const loading = useRouterState({ select: (s) => s.status === 'pending' })

  useEffect(() => {
    trackServerFunctionPosts()
  }, [])

  useEffect(() => {
    if (!loading) return
    startProgress()
    return doneProgress
  }, [loading])

  return null
}
