// The machines' running sounds, rendered once into short loops (world.js plays them). Plain sample
// maths, no Web Audio, so a recipe costs one buffer source when it plays and can be measured outside
// the browser. Rendered at RATE: nothing above 11 kHz can exist in them, and nothing here goes near
// that, a real saw's scream is left out on purpose. The body of each is filtered noise and struck
// wood, oscillators only ever sit far under it, so none of them whine. Every event wraps round the
// end of its loop and every filter is run twice, so a loop has no seam.
export const RATE = 22050

const TAU = Math.PI * 2

function white(n) {
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1
  return x
}

// One-pole lowpass, run through twice so its end meets its start.
function lowpass(x, fc) {
  const a = 1 - Math.exp((-TAU * fc) / RATE)
  const y = new Float32Array(x.length)
  let s = 0
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < x.length; i++) {
      s += a * (x[i] - s)
      y[i] = s
    }
  }
  return y
}

// RBJ bandpass (constant peak), run through twice for the same reason.
function bandpass(x, fc, q) {
  const w = (TAU * fc) / RATE
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const b2 = -alpha / a0
  const a1 = (-2 * Math.cos(w)) / a0
  const a2 = (1 - alpha) / a0
  const y = new Float32Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = x[i]
      y2 = y1
      y1 = v
      y[i] = v
    }
  }
  return y
}

// A slow random shape 0..1 through `points` values, closed round the loop.
function wander(n, points) {
  const at = Array.from({ length: points }, () => Math.random())
  const y = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = (i / n) * points
    const a = Math.floor(p)
    const k = (1 - Math.cos((p - a) * Math.PI)) / 2
    y[i] = at[a % points] * (1 - k) + at[(a + 1) % points] * k
  }
  return y
}

function mix(out, x, gain = 1, shape = null) {
  for (let i = 0; i < out.length; i++) out[i] += x[i] * gain * (shape ? shape(i / out.length, i) : 1)
}

// Something struck at `s` seconds: a decaying partial that sinks in pitch by `sink`, with a burst of
// band noise on the attack. Wraps round the end of the loop.
function strike(out, s, { f, d, gain = 1, sink = 1, grit = 0 }) {
  const n = out.length
  const start = Math.floor(s * RATE) % n
  const len = Math.min(n, Math.floor(d * 6 * RATE))
  let phase = 0
  let rough = 0
  for (let i = 0; i < len; i++) {
    const t = i / RATE
    phase += (TAU * f * (1 + (sink - 1) * Math.min(t / d, 1))) / RATE
    let v = Math.sin(phase) * Math.exp(-t / d)
    if (grit) {
      rough += 0.25 * (Math.random() * 2 - 1 - rough)
      v += rough * grit * Math.exp(-t / (d * 0.3))
    }
    out[(start + i) % n] += v * gain
  }
}

// A partial that fits the loop a whole number of times.
const fit = (f, seconds) => Math.round(f * seconds) / seconds

const rnd = (lo, hi) => lo + Math.random() * (hi - lo)

// Logs turning over in a drum while the bark tears off them.
function debarker(n, s) {
  const out = new Float32Array(n)
  const turn = fit(3, s) // the drum goes round
  mix(out, lowpass(white(n), 150), 3.2, (u) => 0.72 + 0.28 * Math.sin(TAU * turn * s * u))
  const tear = wander(n, 26)
  mix(out, bandpass(white(n), 520, 0.8), 0.55, (u, i) => tear[i] * tear[i])
  mix(out, bandpass(white(n), 240, 0.7), 0.5, (u, i) => 0.4 + tear[n - 1 - i])
  for (let i = 0; i < 18; i++) strike(out, rnd(0, s), { f: rnd(72, 150), d: rnd(0.05, 0.13), gain: rnd(0.2, 0.75), sink: 0.75, grit: 0.5 })
  return out
}

// A heavy blade in timber: the deep part of the cut, with the teeth felt as a grain, not a pitch.
function sawmill(n, s) {
  const out = new Float32Array(n)
  const passing = wander(n, 7)
  const teeth = fit(31, s)
  mix(out, lowpass(white(n), 100), 2.6)
  mix(out, bandpass(white(n), 460, 0.7), 0.6, (u, i) => (0.35 + 0.65 * passing[i]) * (0.7 + 0.3 * Math.sin(TAU * teeth * s * u)))
  mix(out, bandpass(white(n), 980, 1), 0.28, (u, i) => passing[i] * passing[i] * (0.65 + 0.35 * Math.sin(TAU * teeth * s * u + 1)))
  const hum = fit(58, s)
  for (let i = 0; i < n; i++) out[i] += Math.sin((TAU * hum * i) / RATE) * 0.05 + Math.sin((TAU * hum * 2 * i) / RATE) * 0.02
  return out
}

// The firebox: a low roar breathing, and wood crackling in it.
function kiln(n, s) {
  const out = new Float32Array(n)
  const breath = wander(n, 34)
  mix(out, lowpass(white(n), 210), 3, (u, i) => 0.55 + 0.45 * breath[i])
  mix(out, bandpass(white(n), 380, 0.6), 0.28)
  for (let i = 0; i < 46; i++) {
    const pop = Math.random()
    strike(out, rnd(0, s), { f: rnd(650, 1500), d: rnd(0.004, 0.014), gain: 0.06 + pop * pop * pop * 0.55, grit: 0.8 })
  }
  return out
}

// A press coming down on a stack, straps cinching and a breath of air as it lets go, twice.
function bundler(n, s) {
  const out = new Float32Array(n)
  mix(out, lowpass(white(n), 120), 1.5)
  for (let c = 0; c < 2; c++) {
    const at = (c * s) / 2
    strike(out, at, { f: rnd(80, 92), d: 0.13, gain: 1, sink: 0.7, grit: 0.7 })
    strike(out, at + 0.09, { f: rnd(200, 230), d: 0.04, gain: 0.35, grit: 0.4 })
    for (let k = 0; k < 4; k++) strike(out, at + 0.62 + k * rnd(0.11, 0.14), { f: rnd(380, 460), d: 0.018, gain: 0.3, grit: 0.5 })
    const from = (at + 1.45) / s
    const air = bandpass(white(n), 760, 0.8)
    mix(out, air, 0.26, (u) => {
      const k = (u - from) * s
      return k > 0 && k < 0.5 ? Math.sin((k / 0.5) * Math.PI) ** 2 : 0
    })
  }
  return out
}

// Hand work: sandpaper going back and forth and a mallet on joints.
function workshop(n, s) {
  const out = new Float32Array(n)
  const stroke = fit(1.4, s)
  const press = wander(n, 15)
  mix(out, bandpass(white(n), 820, 0.9), 0.65, (u, i) => Math.abs(Math.sin(TAU * stroke * s * u * 0.5)) * (0.35 + 0.65 * press[i]))
  mix(out, lowpass(white(n), 130), 0.7)
  for (let i = 0; i < 6; i++) {
    let at = rnd(0, s)
    const taps = 2 + Math.floor(rnd(0, 3))
    for (let k = 0; k < taps; k++) {
      const f = rnd(340, 420)
      strike(out, at, { f, d: 0.035, gain: 0.5, grit: 0.25 })
      strike(out, at, { f: f * 2.57, d: 0.012, gain: 0.2 })
      at += rnd(0.26, 0.34)
    }
  }
  return out
}

// Rollers turning under a belt.
function belt(n, s) {
  const out = new Float32Array(n)
  mix(out, lowpass(white(n), 115), 2.4)
  for (let at = 0; at < s - 0.1; at += rnd(0.15, 0.24)) strike(out, at, { f: rnd(170, 240), d: 0.016, gain: rnd(0.1, 0.3), grit: 0.25 })
  return out
}

// A big diesel: one soft pressure pulse a cylinder, no two alike. world.js speeds it up with the truck.
function diesel(n, s) {
  const out = new Float32Array(n)
  const fires = Math.round(s * 40)
  const each = n / fires
  for (let i = 0; i < fires; i++) {
    const level = (i % 2 ? 0.72 : 1) * rnd(0.72, 1)
    const start = Math.floor(i * each)
    for (let k = 0; k < each * 0.75; k++) {
      const u = k / (each * 0.75)
      out[start + k] += level * Math.sin(Math.PI * u) ** 2
    }
  }
  let mean = 0
  for (let i = 0; i < n; i++) mean += out[i] / n
  for (let i = 0; i < n; i++) out[i] -= mean
  const body = lowpass(out, 340)
  mix(body, lowpass(white(n), 190), 1.1)
  return body
}

// A steam loco: chuffs at the stack, rail joints under the wagons, weight on the track.
function train(n, s) {
  const out = new Float32Array(n)
  mix(out, lowpass(white(n), 130), 2.4)
  const air = bandpass(white(n), 560, 0.7)
  const chuffs = 8
  mix(out, air, 0.75, (u) => {
    const k = (u * chuffs) % 1
    return Math.exp(-k * 5.5) * (Math.floor(u * chuffs) % 2 ? 0.7 : 1)
  })
  for (let c = 0; c < 2; c++) {
    const at = (c * s) / 2
    strike(out, at, { f: 165, d: 0.035, gain: 0.7, grit: 0.5 })
    strike(out, at + 0.15, { f: 150, d: 0.035, gain: 0.55, grit: 0.5 })
  }
  return out
}

const RECIPES = { debarker: [debarker, 6], sawmill: [sawmill, 8], kiln: [kiln, 8], bundler: [bundler, 5.2], workshop: [workshop, 7], belt: [belt, 4], diesel: [diesel, 2], train: [train, 3.2] }

export const LOOP_NAMES = Object.keys(RECIPES)

// Level every loop to the same RMS with a soft ceiling, so config's levels mean what they say.
export function renderLoop(name) {
  const [recipe, seconds] = RECIPES[name]
  const n = Math.floor(seconds * RATE)
  const x = recipe(n, n / RATE)
  let sum = 0
  for (let i = 0; i < n; i++) sum += x[i] * x[i]
  const gain = 0.2 / Math.sqrt(sum / n)
  for (let i = 0; i < n; i++) x[i] = Math.tanh(x[i] * gain * 1.2) / 1.2
  return x
}
