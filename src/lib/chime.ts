/*
 * New-order chime (Web Audio, no file). Browsers keep audio muted until the
 * person has clicked or typed on the page, and an AudioContext created
 * before that stays "suspended" for good. So there is one shared context,
 * created and resumed on the first click/key press in the admin; later
 * chimes reuse it and therefore always play.
 */

let ctx: AudioContext | null = null
let listening = false
const listeners = new Set<() => void>()

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
  }
  return ctx
}

/** True once the browser lets the page play sound. */
export function audioUnlocked(): boolean {
  return ctx?.state === 'running'
}

/** Called when the unlock state changes (for the "tap to enable sound" hint). */
export function onAudioUnlock(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Unlocks audio on the first user gesture. Safe to call many times. */
export function armAudioUnlock() {
  if (typeof window === 'undefined' || listening) return
  listening = true
  const unlock = () => {
    const c = context()
    if (!c) return
    void c.resume().then(() => {
      if (c.state !== 'running') return
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      for (const fn of listeners) fn()
    })
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/** Three rising notes, ~0.7 s. Returns false when the browser still blocks sound. */
export function chime(): boolean {
  const c = context()
  if (!c) return false
  if (c.state !== 'running') {
    // Not unlocked yet: try (works inside a click handler), report "blocked" for now.
    void c.resume()
    return false
  }
  const start = c.currentTime + 0.02
  for (const [i, freq] of [660, 880, 1320].entries()) {
    const t = start + i * 0.16
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  }
  return true
}
