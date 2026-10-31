// The one-shots, synthesised from physical recipes (synth.js). Nothing here throws or plays before the
// first gesture. Wood and earth first: thuds and knocks carry the game, and the bright parts are short
// and low, so a sound repeated all session stays pleasant.
import { AUDIO, COARSE_POINTER, GAME } from '../config.js'
import { A, ear, isMuted, now, onStart, ready, voice } from './core.js'
import { burst, crinkle, modal, placed, rnd, tone, vary } from './synth.js'

const R = AUDIO.ranges
const COIN = [[1, 1, 0.5], [1.504, 0.6, 0.36], [2.24, 0.45, 0.26], [2.71, 0.3, 0.18], [3.47, 0.22, 0.12], [4.03, 0.12, 0.08]]
const BELL = [[0.5, 0.3, 1.5], [1, 1, 1.3], [1.19, 0.45, 1], [1.5, 0.3, 0.85], [2, 0.42, 0.75], [2.5, 0.18, 0.5], [2.66, 0.22, 0.45], [3.01, 0.1, 0.35], [4.1, 0.06, 0.25]]
const WOOD = [[1, 1, 0.07], [2.57, 0.45, 0.035], [4.2, 0.22, 0.016], [6.1, 0.08, 0.01]]
const PLASTIC = [[1, 1, 0.026], [2.31, 0.5, 0.016], [3.93, 0.28, 0.01]]
const COIN_TOP = 3800 // Hz: a coin's upper modes are what makes it sting

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
  burst({ t, noise: 'pink', f: vary(1800, 0.1), q: 1, d: 0.005, gain: 0.03, bus })
  modal({ t, f: vary(1100, 0.06), modes: PLASTIC, gain: 0.045, bus })
}

// A button with nothing to pay for: chunky, a rubbery squish under the click.
export const press = onPress(() => {
  if (!limit('click', 30) || !voice(0.12, 2)) return
  const t = now()
  const bus = A.ui
  burst({ t, noise: 'pink', f: vary(1700, 0.1), q: 1, d: 0.008, gain: 0.14, bus })
  modal({ t, f: vary(620, 0.05), modes: PLASTIC, gain: 0.18, bus })
  tone({ t, f: vary(140, 0.05), f2: 68, d: 0.06, gain: 0.3, bus })
  burst({ t, type: 'lowpass', f: 900, q: 0.6, a: 0.004, d: 0.045, gain: 0.08, bus })
})

// A HUD or window button. Any that plays its own result sound has just done so: leave it alone.
export function tap() {
  if (performance.now() - (lastAt.get('result') ?? -1e9) > 120) press()
}

// The ON / OFF sign: two clicks a few ms apart and a tiny spring ring.
export const toggle = onPress((on) => {
  if (!voice(0.2, 2)) return
  lastAt.set('result', performance.now())
  const t = now()
  const bus = A.ui
  modal({ t, f: on ? 900 : 1040, modes: PLASTIC, gain: 0.14, bus, strike: 0.08 })
  modal({ t: t + 0.016, f: on ? 1250 : 760, modes: PLASTIC, gain: 0.16, bus, strike: 0.07 })
  tone({ t, f: 180, f2: 90, d: 0.04, gain: 0.15, bus })
})

// Can't afford it: two dull wooden knocks going down.
export const deny = onPress(() => {
  lastAt.set('result', performance.now())
  if (!limit('deny', 140) || !voice(0.2, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: vary(215, 0.03), modes: WOOD, gain: 0.42, strike: 0.15, bus })
  modal({ t: t + 0.09, f: vary(168, 0.03), modes: WOOD, gain: 0.36, strike: 0.12, bus })
  buzz(30)
})

// Bought: a thump, a soft bell, and coins tumbling onto a wooden counter.
export const buy = onPress(() => {
  lastAt.set('result', performance.now())
  if (!limit('buy', 200) || !voice(1.4, 3)) return
  const t = now()
  burst({ t, type: 'lowpass', f: 700, q: 0.7, d: 0.1, gain: 0.32 })
  tone({ t, f: 95, f2: 52, d: 0.1, gain: 0.32 })
  modal({ t: t + 0.03, f: vary(240, 0.03), modes: WOOD, gain: 0.3, strike: 0.08 })
  modal({ t: t + 0.04, f: 660, modes: BELL, gain: 0.16, beat: 4, strike: 0.1, verb: 0.15, top: COIN_TOP })
  const n = COARSE_POINTER ? 5 : 8
  for (let i = 0; i < n; i++) {
    const at = t + 0.06 + Math.pow(i / n, 1.3) * 0.42 + rnd(0, 0.02)
    modal({ t: at, f: rnd(1100, 1800), modes: COIN, gain: 0.07 * (1 - (i / n) * 0.7), beat: 7, decay: rnd(0.4, 0.8), pan: rnd(-0.3, 0.3), bus: A.sfx, verb: 0.08, top: COIN_TOP })
  }
  buzz([20, 40, 30])
})

// A gift opened: paper, then the coins inside.
export const gift = onPress(() => {
  lastAt.set('result', performance.now())
  if (!limit('gift', 150) || !voice(0.7, 2)) return
  const t = now()
  crinkle({ t, n: COARSE_POINTER ? 6 : 10, dur: 0.14, gain: 0.05, f0: 900, f1: 2600, bus: A.ui })
  for (let i = 0; i < 4; i++) modal({ t: t + 0.12 + i * 0.07 + rnd(0, 0.02), f: rnd(1100, 1700), modes: COIN, gain: 0.07, beat: 7, decay: 0.7, pan: rnd(-0.2, 0.2), top: COIN_TOP, verb: 0.08 })
})

// Reborn: a great trunk going down far off and a low bell over it.
export function rebirth() {
  if (!ready() || !voice(2.5, 3)) return
  const t = now()
  tone({ t, f: 70, f2: 34, d: 0.9, gain: 0.5, verb: 0.3 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 280, q: 0.7, a: 0.03, d: 0.9, gain: 0.5, verb: 0.3 })
  modal({ t: t + 0.05, f: 196, modes: BELL, gain: 0.26, beat: 3, decay: 1.5, verb: 0.5, top: COIN_TOP })
  modal({ t: t + 0.09, f: 294, modes: BELL, gain: 0.12, beat: 3, decay: 1.3, verb: 0.5, top: COIN_TOP })
  buzz([30, 60, 50])
}

// The game's own sounds. They happen in the world, so unlike the buttons they are dropped, not
// held back, while the audio is still waiting for its first gesture.

// An axe biting into a trunk: the blade going in, the trunk's knock, a chip or two landing.
export function chop(x, z) {
  if (!limit('chop', 60) || !ready()) return
  const bus = placed(x, ear.y, z, R.chop)
  if (!bus || !voice(0.3, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: vary(1300, 0.15), q: 0.8, d: 0.018, gain: 0.34, bus })
  modal({ t, f: vary(240, 0.08), modes: WOOD, gain: 0.6, strike: 0.14, bus })
  tone({ t, f: vary(125, 0.1), f2: 62, d: 0.085, gain: 0.42, bus })
  for (let i = 0; i < 3; i++) modal({ t: t + rnd(0.05, 0.2), f: rnd(700, 1300), modes: WOOD, gain: rnd(0.02, 0.05), decay: 0.6, bus })
}

// The trunk giving way: fibres letting go, slowly and then all at once, and the crown coming down
// through the air. Lasts as long as the tree takes to go over.
export function creak(x, z) {
  if (!ready()) return
  const bus = placed(x, ear.y, z, R.fall)
  if (!bus || !voice(GAME.fallTime, 2)) return
  const t = now()
  let at = t
  let gap = GAME.fallTime * 0.18
  for (let i = 0; i < 11; i++) {
    modal({ t: at, f: vary(210 + i * 14, 0.12), modes: WOOD, gain: 0.08 + i * 0.022, decay: 1.5, bus })
    at += gap * rnd(0.8, 1.2)
    gap *= 0.86
  }
  burst({ t: t + GAME.fallTime * 0.25, noise: 'pink', f: 420, f2: 1300, q: 0.5, a: GAME.fallTime * 0.65, d: 0.2, gain: 0.2, bus })
}

// A tree hitting the ground: the weight of it, the crown crashing and a few branches settling.
export function fall(x, z) {
  if (!ready()) return
  const bus = placed(x, ear.y, z, R.fall, { verb: 0.25 })
  if (!bus || !voice(0.9, 2)) return
  const t = now()
  tone({ t, f: 80, f2: 36, d: 0.38, gain: 0.55, bus })
  burst({ t, noise: 'brown', type: 'lowpass', f: 330, q: 0.7, a: 0.006, d: 0.36, gain: 0.7, bus })
  burst({ t: t + 0.02, noise: 'pink', f: 880, f2: 260, q: 0.6, a: 0.02, d: 0.5, gain: 0.2, bus })
  modal({ t: t + 0.05, f: vary(150, 0.05), modes: WOOD, gain: 0.5, strike: 0.1, bus })
  modal({ t: t + 0.17, f: vary(205, 0.05), modes: WOOD, gain: 0.26, bus })
  for (let i = 0; i < 5; i++) modal({ t: t + rnd(0.12, 0.65), f: rnd(450, 1000), modes: WOOD, gain: rnd(0.02, 0.06), decay: 0.7, bus })
}

// Going into the hands, onto a belt or into a truck.
export function pick() {
  if (!limit('pick', 50) || !ready() || !voice(0.1, 1)) return
  modal({ t: now(), f: vary(430, 0.08), modes: WOOD, gain: 0.26, strike: 0.1, bus: A.ui })
}

// [knock Hz, gain] of each product hitting a pile, a belt or a truck bed.
const LAND = { log: [165, 0.46], debarked: [185, 0.42], plank: [340, 0.32], dried: [390, 0.3], bundle: [240, 0.42], chair: [500, 0.24], table: [320, 0.34], bed: [270, 0.38] }

// Something set down or thrown somewhere, by anyone: heard from close by only.
export function land(kind, x, y, z) {
  if (!limit('land', 35) || !ready()) return
  const bus = placed(x, y, z, R.land)
  if (!bus || !voice(0.16, 1)) return
  const [f, gain] = LAND[kind] ?? LAND.plank
  const t = now()
  modal({ t, f: vary(f, 0.1), modes: WOOD, gain, strike: 0.05, bus })
  burst({ t, noise: 'brown', type: 'lowpass', f: 230, q: 0.7, d: 0.06, gain: gain * 0.8, bus })
}

// A foot coming down: `on` is a key of AUDIO.steps, `weight` 1 for a stride, more for a landing.
export function step(on, weight = 1) {
  if (!ready() || !voice(0.14, 1)) return
  const S = AUDIO.steps[on]
  const g = weight * rnd(0.82, 1.05)
  const t = now()
  burst({ t, noise: 'brown', type: 'lowpass', f: vary(S.thump, 0.1), q: 0.7, a: 0.003, d: 0.07 + weight * 0.02, gain: S.gain * g })
  burst({ t: t + 0.006, noise: 'pink', f: vary(S.scuff, 0.2), q: 0.9, a: 0.004, d: S.scuffD, gain: S.scuffGain * g, pan: rnd(-0.08, 0.08) })
  if (S.grains) crinkle({ t, n: S.grains, dur: 0.07, gain: S.grit * g, f0: S.band[0], f1: S.band[1], width: 0.15 })
  if (S.knock) modal({ t, f: vary(S.knock, 0.08), modes: WOOD, gain: 0.1 * g })
}

// Paid by hand, one soft coin. The sales nobody is carrying make none: they would never stop.
export function sell() {
  if (!limit('sell', 70) || !ready() || !voice(0.4, 1)) return
  const t = now()
  modal({ t, f: rnd(1100, 1500), modes: COIN, gain: 0.09, beat: 7, decay: 0.7, bus: A.sfx, top: COIN_TOP })
  modal({ t, f: vary(330, 0.08), modes: WOOD, gain: 0.12, bus: A.sfx })
}

// The air horn, heard across the yard: two reeds a little out of tune, soft at the edges.
export function horn(x, z) {
  if (!limit('horn', 900) || !ready()) return
  const bus = placed(x, ear.y, z, R.horn, { verb: 0.2 })
  if (!bus || !voice(0.6, 1)) return
  const t = now()
  for (const f of [147, 185]) {
    tone({ t, type: 'sawtooth', f, a: 0.05, hold: 0.26, d: 0.18, gain: 0.06, lp: 760, bus })
    tone({ t, type: 'sawtooth', f: f * 1.006, a: 0.05, hold: 0.26, d: 0.18, gain: 0.05, lp: 760, bus })
  }
}

// Air brakes letting go as it stops: a breath, not a hiss.
export function airBrake(x, z) {
  if (!limit('air', 400) || !ready()) return
  const bus = placed(x, ear.y, z, R.air)
  if (!bus || !voice(0.5, 1)) return
  burst({ t: now(), noise: 'pink', f: 1300, f2: 600, q: 0.6, a: 0.02, d: 0.45, gain: 0.1, bus })
}

// Far off in the trees. These are gentle on purpose: a sound nobody can quite place.
export function woodpecker(pan) {
  if (!ready() || !voice(1, 1)) return
  const t = now()
  const f = vary(720, 0.1)
  const n = 9 + Math.floor(rnd(0, 6))
  for (let i = 0; i < n; i++) modal({ t: t + i * 0.055, f, modes: WOOD, gain: 0.02 * (0.5 + (0.5 * (n - i)) / n), pan, bus: A.amb, verb: 0.5 })
}

export function dove(pan) {
  if (!ready() || !voice(1.5, 1)) return
  const t = now()
  const f = vary(440, 0.05)
  for (const [at, d, up] of [[0, 0.3, 1.1], [0.42, 0.45, 1.16], [0.95, 0.3, 1.1]]) tone({ t: t + at, f: f / up, f2: f, glide: d * 0.4, a: 0.07, d, gain: 0.022, lp: 900, pan, bus: A.amb, verb: 0.5 })
}

export function owl(pan) {
  if (!ready() || !voice(2, 1)) return
  const t = now()
  const f = vary(320, 0.05)
  for (const [at, d] of [[0, 0.42], [0.62, 0.22], [0.9, 0.7]]) tone({ t: t + at, f: f * 1.06, f2: f * 0.96, a: 0.08, d, gain: 0.03, lp: 700, pan, bus: A.amb, verb: 0.6 })
}
