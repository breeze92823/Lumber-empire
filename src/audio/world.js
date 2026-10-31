// What the yard sounds like from where the player stands: wind and birds all the time, their own feet,
// and the machines, trucks and train only as they get close to them. The player's own yard only.
// Each kind of machine is one loop, however many floors have one: it follows the nearest that is
// working, so the cost is fixed and a stack of floors isn't any louder than one. A loop that has
// gone quiet stops altogether.
import { AIR, AUDIO, GAME, YARD } from '../config.js'
import { A, ear, muffle, nearness, onStart, panTo, ready } from './core.js'
import { LOOP_NAMES, RATE, renderLoop } from './loops.js'
import { rnd } from './synth.js'
import * as sfx from './sfx.js'

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const MACHINES = GAME.line.machines.map((m) => m.id)
const STOP_AFTER = 1.5 // s silent before a loop's source is stopped
const FOOTFALL = Math.PI / 2 // animator phase of a foot at the end of its swing
const MIN_FALL = 5 // m/s down before a landing is heard
const buffers = {}

// Off the main thread when it can be; if the worker can't start, a little at a time here.
function renderLoops() {
  const take = ({ name, samples }) => {
    const buffer = A.ctx.createBuffer(1, samples.length, RATE)
    buffer.copyToChannel(samples, 0)
    buffers[name] = buffer
  }
  const here = () => {
    const name = LOOP_NAMES.find((n) => !buffers[n])
    if (!name) return
    take({ name, samples: renderLoop(name) })
    setTimeout(here, 30)
  }
  try {
    const worker = new Worker(new URL('./loopWorker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      take(data)
      if (LOOP_NAMES.every((n) => buffers[n])) worker.terminate()
    }
    worker.onerror = () => {
      worker.terminate()
      here()
    }
    for (const name of LOOP_NAMES) worker.postMessage(name)
  } catch {
    here()
  }
}

function createVoice(name) {
  const S = AUDIO.voices[name]
  const ctx = A.ctx
  const air = ctx.createBiquadFilter()
  air.type = 'lowpass'
  const gain = ctx.createGain()
  gain.gain.value = 0
  const pan = ctx.createStereoPanner()
  air.connect(gain).connect(pan).connect(A.engine)
  let src = null
  let quiet = 0
  const v = {
    S,
    spin: 0, // 0 stopped .. 1 at speed
    heard: 0, // s the player has been left beside it
    level: 0,
    set(level, k, x, z, rate, dt) {
      const t = ctx.currentTime
      const tc = AUDIO.voiceEvery
      v.level = level
      quiet = level > 0.0005 ? 0 : quiet + dt
      if (quiet > STOP_AFTER) {
        src?.stop()
        src = null
        return
      }
      if (!src && level > 0.0005 && buffers[name]) {
        src = ctx.createBufferSource()
        src.buffer = buffers[name]
        src.loop = true
        src.connect(air)
        src.start(0, Math.random() * buffers[name].duration)
      }
      gain.gain.setTargetAtTime(level, t, tc)
      air.frequency.setTargetAtTime(muffle(k), t, tc)
      pan.pan.setTargetAtTime(panTo(x, z), t, tc)
      if (src) src.playbackRate.setTargetAtTime(rate, t, tc)
    },
  }
  return v
}

// One looped noise bed through a filter, into the ambience.
function bed(noise, type, f, q) {
  const ctx = A.ctx
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = f
  filter.Q.value = q
  const gain = ctx.createGain()
  gain.gain.value = 0
  src.connect(filter).connect(gain).connect(A.amb)
  src.start(0, Math.random() * noise.duration)
  return gain
}

// The nearest point of a run of [x, z] corners, into `out`.
function nearestOnPath(path, px, pz, out) {
  let best = Infinity
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const u = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1)
    const x = ax + dx * u
    const z = az + dz * u
    const d = Math.hypot(px - x, pz - z)
    if (d < best) {
      best = d
      out.x = x
      out.z = z
    }
  }
  return out
}

function surfaceAt(p) {
  const { concrete: C, rail, road } = YARD
  if (p.y > 1) return 'wood'
  if (p.y < -0.5) return 'gravel'
  if (p.x > AIR.apron.west) return 'concrete'
  if (p.x > C.east) return 'needles'
  if (p.x >= C.west && p.z >= C.north && p.z <= C.south) return 'concrete'
  if (Math.abs(p.x - rail.x) < rail.bedWidth / 2) return 'gravel'
  if (p.x >= road.west && p.x <= road.east) return 'concrete'
  return 'grass'
}

export function createSoundscape(yard) {
  const { air, lines, trucks, train } = yard
  const { rows } = YARD.forest
  const Amb = AUDIO.ambience
  const voices = {}
  let wind = null
  let leaves = null
  let rock = null // the tunnel's hum
  let under = 0 // 0 in the open .. 1 down in the tunnel, eased
  let dripLeft = 0
  let gust = 0.5
  let gustGoal = 0.5
  let gustLeft = 0
  let callLeft = rnd(...Amb.calls) * 0.5
  let tick = 0
  let lastBeat = 0
  let wasAir = false
  let fastest = 0
  const spot = { x: 0, z: 0 }

  onStart(() => {
    renderLoops()
    for (const name of LOOP_NAMES) voices[name] = createVoice(name)
    wind = bed(A.noise.pinkStereo, 'lowpass', 420, 0.5)
    leaves = bed(A.noise.pinkStereo, 'bandpass', 1050, 0.5)
    rock = bed(A.noise.brownStereo, 'lowpass', 130, 0.7)
  })

  function updateFeet(you, phase) {
    const speed = Math.hypot(you.velocity.x, you.velocity.z)
    const beat = Math.floor((phase + FOOTFALL) / Math.PI)
    if (beat !== lastBeat && you.grounded && speed > 1.5) sfx.step(surfaceAt(you.position), 1, under * Amb.echo)
    lastBeat = beat
    if (!you.grounded) {
      wasAir = true
      fastest = Math.min(fastest, you.velocity.y)
    } else if (wasAir) {
      wasAir = false
      if (fastest < -MIN_FALL) sfx.step(surfaceAt(you.position), clamp(-fastest / 12, 1, 1.7))
      fastest = 0
    }
  }

  function updateAir(dt, night) {
    gustLeft -= dt
    if (gustLeft <= 0) {
      gustLeft = rnd(...Amb.gust)
      gustGoal = Math.random()
    }
    gust += (gustGoal - gust) * Math.min(1, dt / 2.5)
    const t = A.ctx.currentTime
    const trees = nearness(clamp(ear.x, rows.west, rows.east), ear.y, clamp(ear.z, rows.north, rows.south), Amb.leavesRange)
    const calm = night ? Amb.night : 1
    // Going down the trench the weather stays up on the lawn.
    under += ((air?.tunnel.depth(ear) ?? 0) - under) * Math.min(1, dt * 3)
    const open = 1 - under * 0.92
    wind.gain.setTargetAtTime(Amb.wind * calm * open * (0.65 + 0.7 * gust), t, 0.4)
    leaves.gain.setTargetAtTime(Amb.leaves * calm * open * (0.12 + 0.88 * trees) * (0.25 + 0.95 * gust * gust), t, 0.4)
    rock.gain.setTargetAtTime(Amb.tunnel * under, t, 0.4)

    if (under > 0.5) {
      dripLeft -= dt
      if (dripLeft <= 0) {
        dripLeft = rnd(...Amb.drips)
        sfx.drip(rnd(-0.6, 0.6), Math.random())
      }
    }

    callLeft -= dt
    if (callLeft <= 0 && under < 0.3) {
      callLeft = rnd(...Amb.calls)
      const pan = rnd(0.1, 0.65) * (Math.random() < 0.5 ? -1 : 1)
      if (night) sfx.owl(pan)
      else if (Math.random() < 0.5) sfx.dove(pan)
      else sfx.woodpecker(pan)
    }
  }

  // One voice: `k` how near the loudest source is, `busy` whether it is running at all.
  function drive(v, k, x, z, busy, dt, loud = 1, rate = 1) {
    const { up, down, droop } = AUDIO.spin
    v.spin = clamp(v.spin + (busy ? dt / up : -dt / down), 0, 1)
    v.heard = clamp(v.heard + (k > 0.25 && busy ? dt : -dt * 2), 0, AUDIO.settle)
    const eased = 1 - (1 - AUDIO.rest) * (v.heard / AUDIO.settle)
    v.set(k * k * v.S.level * loud * v.spin * eased, k, x, z, rate * (droop + (1 - droop) * v.spin), dt)
  }

  function updateMachines(dt) {
    MACHINES.forEach((name, i) => {
      const v = voices[name]
      let best = 0
      let x = 0
      let z = 0
      let turbo = false
      for (const line of lines) {
        const m = line.stages[i]
        if (!m.owned || !m.busy || m.progress >= 1) continue
        const k = nearness(m.x, m.base, m.z, v.S.range)
        if (k > best) {
          best = k
          x = m.x
          z = m.z
          turbo = m.turbo
        }
      }
      drive(v, best, x, z, best > 0, dt, turbo ? AUDIO.turbo.level : 1, turbo ? AUDIO.turbo.rate : 1)
    })
  }

  function updateBelt(dt) {
    const v = voices.belt
    let best = 0
    let x = 0
    let z = 0
    for (const line of lines) {
      if (!line.moving) continue
      nearestOnPath(GAME.line.path, ear.x, ear.z, spot)
      const k = nearness(spot.x, line.base + GAME.line.beltY, spot.z, v.S.range)
      if (k > best) {
        best = k
        x = spot.x
        z = spot.z
      }
    }
    for (const run of air ? [air.tunnel, air.links] : []) {
      if (!run.moving) continue
      run.nearest(ear.x, ear.z, spot)
      const k = nearness(spot.x, spot.y, spot.z, v.S.range)
      if (k > best) {
        best = k
        x = spot.x
        z = spot.z
      }
    }
    drive(v, best, x, z, best > 0, dt)
  }

  // The plane, on whichever of the two loops it runs, the other falling quiet. A plane never settles
  // into the background the way a machine does, so `heard` is held at nothing.
  function updatePlane(dt) {
    const you = air?.planes.voice
    for (const name of ['prop', 'jet']) {
      const v = voices[name]
      const on = !!you?.on && you.jet === (name === 'jet')
      const k = on ? nearness(you.x, you.y, you.z, v.S.range) : 0
      const hard = you?.throttle ?? 0
      // The bigger the aircraft the louder and the lower.
      const size = you?.size ?? 0
      v.heard = 0
      drive(v, k, you?.x ?? 0, you?.z ?? 0, k > 0, dt, (0.35 + 0.65 * hard) * (0.72 + 0.5 * size), (v.S.rate[0] + (v.S.rate[1] - v.S.rate[0]) * hard) * (1.14 - 0.3 * size))
    }
  }

  // The truck heard is the loudest one: on the move a long way off, standing only right beside it.
  function updateTrucks(dt) {
    const v = voices.diesel
    const { S } = v
    let best = 0
    let k = 0
    let x = 0
    let z = 0
    let rate = 1
    for (const rig of trucks.rigs) {
      if (!rig.active || !rig.tractor.visible) continue
      const p = rig.tractor.position
      const near = rig.moving ? nearness(p.x, 0, p.z, S.range) : nearness(p.x, 0, p.z, S.idleRange)
      const loud = near * near * (rig.moving ? 1 : S.idle)
      if (loud > best) {
        best = loud
        k = near
        x = p.x
        z = p.z
        rate = rig.moving ? S.rate[0] + (S.rate[1] - S.rate[0]) * Math.min(1, rig.v / GAME.trucks.route.cruise) : S.rate[0]
      }
    }
    drive(v, k, x, z, k > 0, dt, k > 0 ? best / (k * k) : 1, rate)
  }

  function updateTrain(dt) {
    const v = voices.train
    const { S } = v
    const z = clamp(ear.z, train.tail, train.z)
    const k = train.running ? nearness(YARD.rail.x, 0, z, S.range) : 0
    const speed = Math.min(1, train.speed / YARD.train.speed)
    drive(v, k, YARD.rail.x, z, k > 0, dt, 0.3 + 0.7 * speed, S.rate[0] + (S.rate[1] - S.rate[0]) * speed)
  }

  return {
    // `phase` is the avatar's stride, so feet land when they are seen to.
    update(dt, you, phase, night) {
      if (!ready() || !wind) return
      updateFeet(you, phase)
      tick += dt
      if (tick < AUDIO.voiceEvery) return
      updateAir(tick, night)
      updateMachines(tick)
      updateBelt(tick)
      updateTrucks(tick)
      updateTrain(tick)
      updatePlane(tick)
      tick = 0
    },
    get voices() {
      return voices
    },
  }
}
