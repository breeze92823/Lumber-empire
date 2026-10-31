// The board button sounds, synthesised from physical recipes (synth.js). Nothing here throws or plays
// before the first gesture. The recipes are the old game's menu sounds; the rest are in git HEAD.
import { COARSE_POINTER } from '../config.js'
import { A, isMuted, now, onStart, ready, voice } from './core.js'
import { burst, modal, rnd, tone, vary } from './synth.js'

const COIN = [[1, 1, 0.5], [1.504, 0.6, 0.36], [2.24, 0.45, 0.26], [2.71, 0.3, 0.18], [3.47, 0.22, 0.12], [4.03, 0.12, 0.08]]
const BELL = [[0.5, 0.3, 1.5], [1, 1, 1.3], [1.19, 0.45, 1], [1.5, 0.3, 0.85], [2, 0.42, 0.75], [2.5, 0.18, 0.5], [2.66, 0.22, 0.45], [3.01, 0.1, 0.35], [4.1, 0.06, 0.25]]
const WOOD = [[1, 1, 0.07], [2.57, 0.45, 0.035], [4.2, 0.22, 0.016], [6.1, 0.08, 0.01]]
const PLASTIC = [[1, 1, 0.026], [2.31, 0.5, 0.016], [3.93, 0.28, 0.01]]

const lastAt = new Map()
// false if `name` played less than `ms` ago (keeps rapid repeats from stacking).
function limit(name, ms) {
  const t = performance.now()
  if (t - (lastAt.get(name) ?? -1e9) < ms) return false
  lastAt.set(name, t)
  return true
}

// The very first press also starts the audio, whose graph is built a moment later: wait for it.
const onPress = (fn) => (...args) => (ready() ? fn(...args) : onStart(() => setTimeout(() => fn(...args), 80)))

// Phone haptics for the results (Android; iOS ignores it).
function buzz(pattern) {
  if (!COARSE_POINTER || isMuted()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not allowed in this frame.
  }
}

// The mouse landing on a button: a light tap on a plastic tile.
export function hover() {
  if (!limit('hover', 40) || !voice(0.06, 1)) return
  const t = now()
  const bus = A.ui
  burst({ t, f: vary(6000, 0.1), q: 1.4, d: 0.004, gain: 0.06, bus })
  modal({ t, f: vary(2300, 0.06), modes: PLASTIC, gain: 0.06, bus })
}

// A button with nothing to pay for: chunky, a rubbery squish under the click.
export const press = onPress(() => {
  if (!limit('click', 30) || !voice(0.12, 2)) return
  const t = now()
  const bus = A.ui
  burst({ t, f: vary(3000, 0.1), q: 1, d: 0.008, gain: 0.2, bus })
  modal({ t, f: vary(820, 0.05), modes: PLASTIC, gain: 0.18, bus })
  tone({ t, f: vary(140, 0.05), f2: 68, d: 0.06, gain: 0.3, bus })
  burst({ t, type: 'lowpass', f: 900, q: 0.6, a: 0.004, d: 0.045, gain: 0.08, bus })
})

// The ON / OFF sign: two clicks a few ms apart and a tiny spring ring.
export const toggle = onPress((on) => {
  if (!voice(0.2, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: on ? 1500 : 1700, modes: PLASTIC, gain: 0.14, bus, strike: 0.12 })
  modal({ t: t + 0.016, f: on ? 2100 : 1250, modes: PLASTIC, gain: 0.16, bus, strike: 0.1 })
  modal({ t: t + 0.016, f: on ? 3400 : 2900, modes: COIN, gain: 0.025, decay: 0.3, bus })
  tone({ t, f: 180, f2: 90, d: 0.04, gain: 0.15, bus })
})

// Can't afford it: two dull wooden knocks going down.
export const deny = onPress(() => {
  if (!limit('deny', 140) || !voice(0.2, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: vary(215, 0.03), modes: WOOD, gain: 0.42, strike: 0.15, bus })
  modal({ t: t + 0.09, f: vary(168, 0.03), modes: WOOD, gain: 0.36, strike: 0.12, bus })
  buzz(30)
})

// Bought: a thump, a bell, and coins tumbling onto the counter.
export const buy = onPress(() => {
  if (!limit('buy', 200) || !voice(1.4, 3)) return
  const t = now()
  burst({ t, type: 'lowpass', f: 700, q: 0.7, d: 0.1, gain: 0.32 })
  tone({ t, f: 95, f2: 52, d: 0.1, gain: 0.32 })
  modal({ t: t + 0.04, f: 1046, modes: BELL, gain: 0.2, beat: 4, strike: 0.2, verb: 0.15 })
  const n = COARSE_POINTER ? 6 : 10
  for (let i = 0; i < n; i++) {
    const at = t + 0.06 + Math.pow(i / n, 1.3) * 0.45 + rnd(0, 0.02)
    modal({ t: at, f: rnd(2500, 4400), modes: COIN, gain: 0.09 * (1 - (i / n) * 0.7), beat: 7, strike: 0.25, decay: rnd(0.5, 1), pan: rnd(-0.3, 0.3), bus: A.sfx, verb: 0.08 })
  }
  buzz([20, 40, 30])
})

// The game's own sounds. They happen in the world, so unlike the buttons they are dropped, not
// held back, while the audio is still waiting for its first gesture.

// An axe biting into a trunk: a sharp crack and a woody knock.
export function chop() {
  if (!limit('chop', 60) || !ready() || !voice(0.2, 2)) return
  const t = now()
  burst({ t, f: vary(2600, 0.15), q: 0.9, d: 0.012, gain: 0.3 })
  modal({ t, f: vary(310, 0.08), modes: WOOD, gain: 0.5, strike: 0.2 })
}

// A tree hitting the ground.
export function fall() {
  if (!ready() || !voice(0.6, 2)) return
  const t = now()
  burst({ t, type: 'lowpass', f: 420, q: 0.7, a: 0.01, d: 0.3, gain: 0.5 })
  tone({ t, f: 90, f2: 40, d: 0.28, gain: 0.45 })
  modal({ t: t + 0.05, f: vary(170, 0.05), modes: WOOD, gain: 0.5, strike: 0.15 })
}

// Something wooden going into the hands, onto a belt or into a truck.
export function pick() {
  if (!limit('pick', 50) || !ready() || !voice(0.1, 1)) return
  modal({ t: now(), f: vary(520, 0.08), modes: WOOD, gain: 0.3, strike: 0.2, bus: A.ui })
}

// Paid: one small coin.
export function sell() {
  if (!limit('sell', 70) || !ready() || !voice(0.4, 1)) return
  modal({ t: now(), f: rnd(2600, 3600), modes: COIN, gain: 0.16, beat: 7, strike: 0.25, bus: A.sfx })
}

// Trucks, each scaled by how near it is (0..1).
// The air horn: two reedy notes a little out of tune with each other.
export function horn(near = 1) {
  if (!limit('horn', 900) || !ready() || !voice(0.5, 1)) return
  const t = now()
  for (const f of [233, 294]) {
    tone({ t, type: 'sawtooth', f, a: 0.02, hold: 0.28, d: 0.14, gain: 0.05 * near, lp: 1800 })
    tone({ t, type: 'sawtooth', f: f * 1.006, a: 0.02, hold: 0.28, d: 0.14, gain: 0.04 * near, lp: 1800 })
  }
}

// Air brakes letting go as it stops.
export function airBrake(near = 1) {
  if (!limit('air', 400) || !ready() || !voice(0.2, 1)) return
  burst({ t: now(), type: 'highpass', f: 2600, q: 0.5, a: 0.01, d: 0.5, gain: 0.08 * near })
}

// The reversing alarm.
export function reverseBeep(near = 1) {
  if (!limit('beep', 500) || !ready() || !voice(0.1, 1)) return
  tone({ t: now(), type: 'square', f: 1180, a: 0.005, hold: 0.28, d: 0.03, gain: 0.03 * near })
}
