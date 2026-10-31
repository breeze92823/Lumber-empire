import { InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three'
import { GAME, YARD } from '../config.js'
import { createEmitter } from '../particles.js'
import { rigTemplate } from './rigModels.js'

// One truck on the move. A route is a centre line sampled every STEP metres, always in the
// direction the nose points, so a truck backs up by running its s down. The drive axles sit on the
// line at s and the front axle at s + wheelbase, which gives the heading and the steering; the
// trailer's axles sit on the line too, at the point its own length away from the fifth wheel. That
// makes it swing out and follow through a turn, forwards and backwards, without ever jack-knifing.
const R = GAME.trucks.route
const STEP = 0.25
const SPRING = 70
const DAMPING = 8.5
const up = (a, b, k) => a + (b - a) * k
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// --- Routes -----------------------------------------------------------------------
// trace(x, z).to(x, z).arc(cx, cz, r, from, to) ... .done({ near }), angles measured from +x to +z.
export function trace(x0, z0) {
  const pts = [[x0, z0]]
  const self = {
    to(x, z) {
      pts.push([x, z])
      return self
    },
    arc(cx, cz, r, a0, a1) {
      const n = Math.ceil(Math.abs(a1 - a0) * r * 2)
      for (let i = 1; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n
        pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
      }
      return self
    },
    done: (opts) => sample(pts, opts),
  }
  return self
}

function sample(pts, { near = false } = {}) {
  const xs = []
  const zs = []
  let run = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    while (run <= len) {
      xs.push(ax + ((bx - ax) * run) / len)
      zs.push(az + ((bz - az) * run) / len)
      run += STEP
    }
    run -= len
  }
  const n = xs.length
  const speed = new Float32Array(n)
  const dir = (i) => Math.atan2(xs[i + 1] - xs[i], zs[i + 1] - zs[i])
  for (let i = 0; i < n; i++) {
    const a = Math.max(i - 4, 0)
    const b = Math.min(i + 4, n - 2)
    const bend = b > a ? Math.abs(wrap(dir(b) - dir(a))) / ((b - a) * STEP) : 0
    let v = bend > 1e-3 ? Math.sqrt(R.cornering / bend) : R.cruise
    if (xs[i] > YARD.road.east) v = Math.min(v, R.yard)
    if (near && zs[i] > R.nearZ) v = Math.min(v, R.near)
    speed[i] = Math.min(v, R.cruise)
  }
  for (let i = n - 2; i >= 0; i--) speed[i] = Math.min(speed[i], Math.sqrt(speed[i + 1] ** 2 + 2 * R.brake * R.ease * STEP))
  return { x: xs, z: zs, n, speed, len: (n - 1) * STEP }
}

function at(r, s, out) {
  const f = s / STEP
  const i = clamp(Math.floor(f), 0, r.n - 2)
  const k = f - i // past either end it runs on straight
  out.x = up(r.x[i], r.x[i + 1], k)
  out.z = up(r.z[i], r.z[i + 1], k)
  return out
}

// The speed it wants here. `end` = null runs off the end of the route without stopping.
function target(r, s, end, reversing) {
  const free = reversing ? R.reverse : r.speed[clamp(Math.round(s / STEP), 0, r.n - 1)]
  if (end === null) return free
  const left = Math.max(reversing ? s - end : end - s, 0)
  return Math.min(free, Math.sqrt(2 * R.brake * R.ease * left) + 0.2)
}

// m/s2 towards a speed: the power falls away as it gets going.
const pull = (v, want) => clamp((want - v) * 4, -R.brake, R.accel * (1 - 0.72 * Math.min(v / R.cruise, 1)))

// Seconds a clear run from s to end takes, for a truck that sets off so as to be there on time.
export function travelTime(r, s, end, reversing = false, v = 0) {
  const h = 1 / 20
  let t = 0
  while ((reversing ? s - end : end - s) > 0.05 && t < 120) {
    v = Math.max(v + pull(v, target(r, s, end, reversing)) * h, 0.2)
    s += (reversing ? -v : v) * h
    t += h
  }
  return t
}

// The bump where the road goes over the rails, so the truck rides it axle by axle.
function groundAt(x) {
  const { from, top, end, to, height } = YARD.road.crossing
  if (x < from || x > to) return 0
  if (x < top) return (height * (x - from)) / (top - from)
  if (x > end) return (height * (to - x)) / (to - end)
  return height
}

const a = { x: 0, z: 0 }
const b = { x: 0, z: 0 }
const c = { x: 0, z: 0 }
const m = new Matrix4()
const cargoMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })

function collect(root, parts) {
  root.traverse((o) => {
    if (o.userData.spin) parts.spin.push(o)
    if (o.userData.steer) parts.steer.push(o)
    if (o.userData.flap) parts.flaps.push(o)
    if (o.name === 'sprung') parts.sprung = o
    if (o.name.startsWith('lamp-')) parts.lamps[o.name.slice(5)]?.push(o)
    if (o.material?.userData.k === 'paint') {
      parts.paint ??= o.material.clone()
      o.material = parts.paint
    }
  })
}

// parent: the scene. world: { rigs, player, night, train, sound(name, x, z) }, read every frame.
export function createRig(parent, name, world) {
  const T = rigTemplate(name)
  const tractor = T.tractor.clone(true)
  const trailer = T.trailer?.clone(true) ?? null
  const parts = { spin: [], steer: [], flaps: [], sprung: null, paint: null, lamps: { head: [], brake: [], reverse: [], left: [], right: [] } }
  collect(tractor, parts)
  if (trailer) collect(trailer, parts)
  for (const u of [tractor, trailer]) {
    if (!u) continue
    u.rotation.order = 'YXZ'
    u.visible = false
    parent.add(u)
  }
  const { spin, steer, flaps, sprung, lamps, paint } = parts
  const sprungY = sprung.position.y

  const load = new InstancedMesh(T.cargo.geo, cargoMat, T.cargo.slots.length)
  T.cargo.slots.forEach(([x, y, z], i) => load.setMatrixAt(i, m.makeTranslation(x, y, z)))
  load.count = 0
  load.castShadow = true
  load.frustumCulled = false
  const carrier = T.cargo.unit === 'trailer' ? trailer : tractor
  carrier.add(load)

  const smoke = createEmitter(tractor, {
    boxes: T.stacks.map(([x, y, z]) => ({ x, y, z, sx: 0.05, sy: 0.05, sz: 0.05 })),
    count: 26 * T.stacks.length,
    life: 1.5,
    velocity: [0, 2, 0],
    spread: [0.3, 0.4, 0.3],
    size: 0.42,
    grow: 3.4,
    color: '#6a6b72',
    opacity: 0,
    solid: true,
    seed: 41,
  })
  smoke.visible = false

  const pitch = { x: 0, v: 0 }
  const roll = { x: 0, v: 0 }
  const spring = (p, want, dt) => {
    p.v += ((want - p.x) * SPRING - p.v * DAMPING) * dt
    p.x += p.v * dt
  }

  let route = null
  let end = 0
  let reversing = false
  let arrived = null
  let wheel = 0 // road angle of the front wheels
  let trailerS = 0
  let yawNow = 0
  let gear = 0
  let shifting = 0
  let popped = 1
  let waited = false
  const phase = Math.random() * 10

  const show = (list, on) => {
    for (const o of list) if (o.visible !== on) o.visible = on
  }

  function pose() {
    at(route, rig.s, a)
    at(route, rig.s + T.wheelbase, b)
    const yaw = Math.atan2(b.x - a.x, b.z - a.z)
    yawNow = yaw
    const y = groundAt(a.x)
    tractor.position.set(a.x, y, a.z)
    tractor.rotation.set(-Math.atan2(groundAt(b.x) - y, T.wheelbase), yaw, 0)
    if (!trailer) return yaw
    const kx = a.x + Math.sin(yaw) * T.kingpin
    const kz = a.z + Math.cos(yaw) * T.kingpin
    for (let i = 0; i < 4; i++) {
      at(route, trailerS, c)
      trailerS += Math.hypot(kx - c.x, kz - c.z) - T.reach
    }
    at(route, trailerS, c)
    const ty = groundAt(c.x)
    trailer.position.set(c.x, ty, c.z)
    trailer.rotation.set(-Math.atan2(groundAt(kx) - ty, T.reach), Math.atan2(kx - c.x, kz - c.z), 0)
    return yaw
  }

  // True if `x, z` is in the lane just ahead of the leading end, `reach` metres out.
  function inPath(x, z, lx, lz, dx, dz, reach) {
    const px = x - lx
    const pz = z - lz
    const along = px * dx + pz * dz
    return along > -0.6 && along < reach && Math.abs(px * dz - pz * dx) < 2.1
  }

  function held(v) {
    const sign = reversing ? -1 : 1
    const end2 = reversing ? (trailer ?? tractor) : tractor
    const yaw = end2.rotation.y
    const dx = Math.sin(yaw) * sign
    const dz = Math.cos(yaw) * sign
    const off = reversing ? rig.rear : T.nose
    const lx = end2.position.x + dx * off
    const lz = end2.position.z + dz * off
    const reach = (v * v) / (2 * R.brake * R.ease) + R.gap
    // The player walks through trucks, so a truck never waits for them.
    const { x: railX, bedWidth } = YARD.rail
    const across = (x) => Math.abs(x - railX) < bedWidth / 2
    if (!across(lx) && across(lx + dx * reach) && world.train?.blocks(lz)) return 'train'
    if (reversing) return null
    for (const other of world.rigs) {
      if (other === rig || !other.active) continue
      for (const p of other.points) if (inPath(p.position.x, p.position.z, lx, lz, dx, dz, reach)) return 'rig'
    }
    return null
  }

  const rig = {
    name,
    T,
    tractor,
    trailer,
    paint,
    active: false,
    moving: false,
    rainbow: false,
    s: 0,
    v: 0,
    points: trailer ? [tractor, trailer] : [tractor],
    rear: T.tail - (trailer ? T.reach - T.kingpin : 0),
    place(r, s) {
      route = r
      rig.s = s
      trailerS = s + T.kingpin - T.reach
      rig.active = true
      rig.moving = false
      rig.v = 0
      gear = 0
      reversing = false
      tractor.visible = true
      if (trailer) trailer.visible = true
      popped = 1
      tractor.scale.setScalar(1)
      trailer?.scale.setScalar(1)
      show(lamps.brake, false)
      show(lamps.reverse, false)
      show(lamps.left, false)
      show(lamps.right, false)
      pose()
    },
    // Rolls along r from s to `to` (null = on off the far end), or backs down it, and calls done.
    drive(r, s, to, back, done) {
      route = r
      if (s !== rig.s) trailerS = s + T.kingpin - T.reach
      rig.s = s
      end = to
      reversing = back
      arrived = done
      rig.moving = true
      waited = false
      smoke.visible = true
      pose()
    },
    // Goes back in the pool.
    hide() {
      rig.active = false
      rig.moving = false
      rig.rainbow = false
      tractor.visible = false
      if (trailer) trailer.visible = false
      smoke.visible = false
      load.count = 0
    },
    setLoad(n) {
      load.count = Math.min(n, T.cargo.slots.length)
    },
    // World point of cargo slot i, for items to fly at.
    slot(i) {
      const [x, y, z] = T.cargo.slots[Math.min(i, T.cargo.slots.length - 1)]
      carrier.updateWorldMatrix(true, false)
      const p = new Vector3(x, y, z).applyMatrix4(carrier.matrixWorld)
      return { x: p.x, y: p.y, z: p.z }
    },
    // The new truck jumping into its bay.
    pop() {
      popped = 0
    },
    update(dt, elapsed) {
      if (dt <= 0) return
      const h = Math.min(dt, 1 / 30)
      let accel = 0
      let lean = 0
      if (rig.moving) {
        let want = target(route, rig.s, end, reversing)
        const stop = held(rig.v)
        if (stop) {
          want = 0
          if (!waited && rig.v < 1.5 && stop !== 'rig') {
            waited = true
            world.sound('horn', tractor.position.x, tractor.position.z)
          }
        } else {
          waited = false
        }
        accel = pull(rig.v, want)
        shifting -= h
        if (shifting > 0) accel = Math.min(accel, 0.05)
        const before = rig.v
        rig.v = Math.max(rig.v + accel * h, 0)
        if (rig.v < 0.02 && want === 0) rig.v = 0
        accel = (rig.v - before) / h
        if (!reversing && accel > 0 && rig.v > (R.gears[gear] ?? Infinity)) {
          gear++
          shifting = R.shift
        } else if (gear > 0 && rig.v < R.gears[gear - 1] - 2) {
          gear--
        }
        rig.s += (reversing ? -rig.v : rig.v) * h
        const yaw0 = yawNow
        const yaw = pose()
        const signed = reversing ? -rig.v : rig.v
        lean = (signed * wrap(yaw - yaw0)) / h
        at(route, rig.s + T.wheelbase, b)
        at(route, rig.s + T.wheelbase + 1, c)
        const road = wrap(Math.atan2(c.x - b.x, c.z - b.z) - yaw)
        wheel += clamp(road - wheel, -1.4 * h, 1.4 * h)
        const turn = rig.v * h * (reversing ? -1 : 1)
        for (const o of spin) o.rotation.x += turn / o.userData.spin
        for (const o of steer) o.rotation.y = wheel
        const swing = Math.min(rig.v * 0.03, 0.55) + Math.sin(elapsed * 11 + phase) * Math.min(rig.v * 0.012, 0.09)
        for (const o of flaps) o.rotation.x = swing

        at(route, rig.s + T.wheelbase + 22, c)
        const ahead = wrap(Math.atan2(c.x - b.x, c.z - b.z) - yaw)
        const flash = elapsed * 1.5 % 1 < 0.5
        show(lamps.left, flash && (reversing || ahead > 0.25))
        show(lamps.right, flash && (reversing || ahead < -0.25))
        show(lamps.brake, accel < -0.7 || rig.v < 0.05 || world.night)
        show(lamps.reverse, reversing)

        // Harder on the throttle = darker, and it trails off behind the stacks at speed.
        const throttle = clamp(accel / R.accel, 0, 1)
        smoke.material.uniforms.uOpacity.value = up(smoke.material.uniforms.uOpacity.value, 0.1 + throttle * 0.34, Math.min(h * 5, 1))
        smoke.material.uniforms.uVelocity.value[2] = -signed * 0.7

        // Out at the far end of the road it goes over the horizon.
        const k = clamp((tractor.position.z - R.reach) / R.horizon, 0, 1)
        tractor.scale.setScalar(k)
        trailer?.scale.setScalar(k)

        const left = end === null ? route.len - rig.s : reversing ? rig.s - end : end - rig.s
        if (left < 0.03) {
          rig.s = end
          rig.v = 0
          rig.moving = false
          accel = -1
          show(lamps.left, false)
          show(lamps.right, false)
          show(lamps.reverse, false)
          show(lamps.brake, world.night)
          smoke.visible = false
          world.sound('air', tractor.position.x, tractor.position.z)
          const done = arrived
          arrived = null
          done?.()
        }
      }

      show(lamps.head, world.night)
      if (rig.rainbow) paint.color.setHSL((elapsed * GAME.rainbowSpeed) % 1, 0.9, 0.6)
      spring(pitch, clamp(-accel * R.dive, -0.05, 0.05), h)
      spring(roll, clamp(lean * R.sway, -0.07, 0.07), h)
      const road = Math.min(rig.v * 0.08, 1)
      sprung.rotation.x = pitch.x + Math.sin(elapsed * 7.3 + phase) * 0.0035 * road
      sprung.rotation.z = roll.x + Math.sin(elapsed * 5.1 + phase) * 0.0025 * road
      // The engine's shake at idle, a road's lift when it runs.
      sprung.position.y = sprungY + Math.sin(elapsed * 46 + phase) * 0.0035 * (1 - road * 0.7) + Math.sin(elapsed * 9 + phase) * 0.01 * road

      if (popped < 1) {
        popped = Math.min(popped + h * 1.8, 1)
        const k = 1 + Math.sin(popped * Math.PI * 3) * (1 - popped) * 0.34
        const w = 1 + (1 - k) * 0.5
        tractor.scale.set(w, k, w)
        trailer?.scale.set(w, k, w)
      }
    },
  }
  return rig
}
