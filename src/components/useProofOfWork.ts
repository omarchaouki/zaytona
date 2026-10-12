import { type Challenge, solveChallenge } from 'altcha-lib'
import { deriveKey } from 'altcha-lib/algorithms/web/sha'
import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { getPowChallenge } from '~/server/functions/public'

type Pending = {
  expiresAt: number
  controller: AbortController
  payload: Promise<string | undefined>
}

async function solve(controller: AbortController): Promise<string | undefined> {
  try {
    const challenge: Challenge = await getPowChallenge()
    const solution = await solveChallenge({ challenge, deriveKey, controller, timeout: 60_000 })
    if (!solution) return undefined
    return btoa(JSON.stringify({ challenge, solution }))
  } catch {
    return undefined
  }
}

/**
 * Anti-bot proof of work (see src/server/pow.ts), invisible to people: the
 * browser starts solving when the form comes near the screen or gets focus,
 * so the answer is usually ready before the visitor taps "send". `take()`
 * hands out the answer and starts the next one (each is accepted once).
 */
export function useProofOfWork(target: RefObject<Element | null>) {
  const pending = useRef<Pending | null>(null)

  const start = useCallback(() => {
    const current = pending.current
    if (current && current.expiresAt > Date.now()) return current
    current?.controller.abort()
    const controller = new AbortController()
    const next: Pending = {
      // Challenges live two hours on the server; refresh a little before that.
      expiresAt: Date.now() + 100 * 60 * 1000,
      controller,
      payload: solve(controller),
    }
    pending.current = next
    return next
  }, [])

  useEffect(() => {
    const el = target.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          start()
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(el)
    el.addEventListener('focusin', start, { once: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('focusin', start)
      pending.current?.controller.abort()
    }
  }, [target, start])

  const take = useCallback(async () => {
    let payload = await start().payload
    pending.current = null
    // A failed fetch or solve gets one more try before the form gives up.
    if (!payload) {
      payload = await start().payload
      pending.current = null
    }
    // Warm up the next one in case this submission needs a retry.
    start()
    return payload
  }, [start])

  return { take }
}
