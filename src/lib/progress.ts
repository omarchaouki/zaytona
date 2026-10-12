/*
 * Thin loading line at the top of the window, in the style of Livewire's
 * wire:navigate bar (NProgress): it waits 150 ms so fast responses show
 * nothing, creeps forward in smaller and smaller steps while waiting, then
 * runs to the end and fades. Calls nest: the line stays until every start()
 * has its done(). Browser only; plain DOM so it never re-renders React.
 */

const SHOW_DELAY_MS = 150
const TRICKLE_MS = 250

let active = 0
let value = 0
let root: HTMLDivElement | null = null
let bar: HTMLDivElement | null = null
let showTimer: number | undefined
let trickleTimer: number | undefined
let hideTimer: number | undefined

function mount() {
  if (root) return
  root = document.createElement('div')
  root.className = 'top-progress'
  root.setAttribute('aria-hidden', 'true')
  bar = document.createElement('div')
  bar.className = 'top-progress-bar'
  const peg = document.createElement('div')
  peg.className = 'top-progress-peg'
  bar.append(peg)
  root.append(bar)
  document.body.append(root)
}

function render() {
  bar?.style.setProperty('--progress', String(value))
}

function trickle() {
  const step = value < 0.2 ? 0.1 : value < 0.5 ? 0.04 : value < 0.8 ? 0.02 : 0.005
  value = Math.min(0.994, value + step * (0.5 + Math.random()))
  render()
}

function show() {
  mount()
  window.clearTimeout(hideTimer)
  root?.classList.remove('is-done')
  root?.classList.add('is-active')
  value = 0.08
  render()
  trickleTimer = window.setInterval(trickle, TRICKLE_MS)
}

export function startProgress() {
  active += 1
  if (active > 1 || typeof window === 'undefined') return
  window.clearTimeout(showTimer)
  showTimer = window.setTimeout(show, SHOW_DELAY_MS)
}

export function doneProgress() {
  if (active === 0) return
  active -= 1
  if (active > 0) return
  window.clearTimeout(showTimer)
  window.clearInterval(trickleTimer)
  if (!root?.classList.contains('is-active')) return
  value = 1
  render()
  root.classList.add('is-done')
  hideTimer = window.setTimeout(() => {
    root?.classList.remove('is-active', 'is-done')
    value = 0
    render()
  }, 500)
}

/** Runs a promise with the line showing. */
export async function withProgress<T>(promise: Promise<T>): Promise<T> {
  startProgress()
  try {
    return await promise
  } finally {
    doneProgress()
  }
}

/**
 * Shows the line for every server-function POST (form submissions, admin
 * saves). GET server functions run inside navigations, which the router
 * reports on its own, or in the background (anti-bot challenge): no line.
 */
export function trackServerFunctionPosts() {
  if (typeof window === 'undefined' || (window.fetch as { tracked?: boolean }).tracked) return
  const original = window.fetch.bind(window)
  const tracked: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (method === 'POST' && url.includes('/_serverFn/')) return withProgress(original(input, init))
    return original(input, init)
  }
  Object.assign(tracked, { tracked: true })
  window.fetch = tracked
}
