import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping } from 'three'
import { GAME, YARD } from '../config.js'
import { neon, solidBox, solidPole } from '../propkit.js'
import { bar, box, matte, place } from './kit.js'
import { polyline, room } from './line.js'
import { paintBelt } from './paint.js'

// Bay Conveyers: a belt from the middle of the line to one truck bay, so a truck the finished
// goods aren't reaching still gets work. A kicker at the end of a machine's belt throws an item
// off once the next machine has `backlog` to get through and the truck has room for it (booked as
// the Truck Conveyer books it), so the line never loses what it could have finished and no wood is
// left riding a belt to a truck that isn't there. The item rides a cleated incline and a gallery on
// trestles to the head of the belt, where a gantry crane over the bay lifts it over the Truck
// Conveyer and sets it down on the truck. The lamp shows amber while wood waits for a truck.
const { line: L } = GAME
const { feeds: F } = L
const { crane: K } = F
const { colors: C } = YARD
const HALF = F.width / 2
const STEEL = '#8f949c'
const POST_X = 14.5 // the kicker's post, east of the line
const RAM_X = 13.15 // its paddle at rest, inside the guard rail
const STROKE = 1.2
const PICK = 1.4 // m short of the head that items stop, so a whole one lies on the belt

// A group lying along a to b, local +Z running with the belt, and how long it is.
export function along([ax, ay, az], [bx, by, bz]) {
  const g = new Group()
  g.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
  g.rotation.order = 'YXZ'
  g.rotation.y = Math.atan2(bx - ax, bz - az)
  g.rotation.x = -Math.atan2(by - ay, Math.hypot(bx - ax, bz - az))
  return { g, len: Math.hypot(bx - ax, by - ay, bz - az) }
}

// A belt's frame: stringers, return idlers, skirts, a yellow guard and, on +X, a railed walkway.
function buildFrame(g, len, cleats) {
  const steel = matte(C.navy)
  const roller = matte(STEEL)
  const rail = matte(C.guardRail)
  const grate = matte('#4a5060')
  const edge = HALF + 0.08
  for (const x of [-edge, edge]) {
    box(g, steel, 0.16, 0.36, len, x, -0.24, 0)
    box(g, matte('#2b3040'), 0.05, 0.28, len, x * 0.97, 0.13, 0) // skirt board
    box(g, rail, 0.1, 0.1, len, x, 0.56, 0)
    const posts = Math.max(2, Math.round(len / 1.8))
    for (let i = 0; i <= posts; i++) box(g, rail, 0.09, 0.5, 0.09, x, 0.3, -len / 2 + (i * len) / posts)
  }
  box(g, matte('#23262f'), F.width + 0.1, 0.05, len, 0, -0.1, 0) // carries the belt
  for (let z = -len / 2 + 0.6; z < len / 2; z += 1.8) bar(g, roller, 0.09, F.width, 0, -0.32, z, 'x', 8)

  box(g, grate, 0.72, 0.05, len, edge + 0.42, -0.34, 0)
  box(g, rail, 0.07, 0.07, len, edge + 0.76, 0.72, 0)
  box(g, rail, 0.05, 0.05, len, edge + 0.76, 0.2, 0)
  const bays = Math.max(2, Math.round(len / 2.2))
  for (let i = 0; i <= bays; i++) {
    const z = -len / 2 + (i * len) / bays
    box(g, rail, 0.07, 1.08, 0.07, edge + 0.76, 0.19, z)
    box(g, steel, 0.8, 0.1, 0.1, edge + 0.38, -0.4, z)
  }
  if (cleats) for (let z = -len / 2 + 0.3; z < len / 2; z += 0.55) box(g, steel, 0.68, 0.05, 0.07, edge + 0.42, -0.3, z)
}

// A trestle bent across the belt: two legs on footings, cross-braced, carrying the belt at `y`.
function buildTrestle(y) {
  const g = new Group()
  const steel = matte(C.navy)
  const h = y - 0.46
  const span = 1
  for (const x of [-span, span]) {
    box(g, steel, 0.26, h, 0.26, x, h / 2, 0)
    box(g, matte('#b9b5ad'), 0.9, 0.16, 0.9, x, 0.08, 0)
  }
  box(g, steel, 2.9, 0.2, 0.3, 0.5, h + 0.02, 0) // reaches out under the walkway
  const tiers = Math.max(1, Math.floor(h / 2.6))
  const rise = h / tiers
  const brace = Math.atan2(span * 2, rise)
  for (let i = 0; i < tiers; i++) {
    box(g, steel, 2, 0.12, 0.12, 0, rise * (i + 1), 0)
    for (const side of [-1, 1]) box(g, steel, 0.09, Math.hypot(span * 2, rise), 0.09, 0, rise * (i + 0.5), 0, 0, 0, side * brace)
  }
  return g
}

// The drive at the head: pulley, gearbox and motor on a bracket, and the plate items stop against.
function buildHead(g, z) {
  const blue = matte('#2452de', { roughness: 0.35 })
  const steel = matte(C.navy)
  bar(g, matte(STEEL), 0.3, F.width, 0, -0.1, z, 'x', 14)
  bar(g, steel, 0.09, F.width + 1.5, -0.6, -0.1, z, 'x', 10)
  box(g, steel, 0.5, 0.56, 0.62, -HALF - 0.56, -0.1, z)
  bar(g, blue, 0.23, 0.9, -HALF - 0.56, -0.1, z - 0.76, 'z', 12)
  for (let i = 0; i < 4; i++) bar(g, matte('#1c3cae'), 0.25, 0.05, -HALF - 0.56, -0.1, z - 0.42 - i * 0.2, 'z', 12)
  box(g, steel, 0.8, 0.1, 1.7, -HALF - 0.56, -0.42, z - 0.4)
  box(g, matte('#f2c21c'), F.width + 0.2, 0.7, 0.12, 0, 0.3, z + 0.05)
}

// A straight tie between two points.
function tie(g, mat, a, b, width) {
  const { g: rod, len } = along(a, b)
  box(rod, mat, width, width, len)
  g.add(rod)
}

// The bay's gantry crane, in world x and y with local z = 0 on the bay: a portal straddling the
// head of the belt, carrying a box boom out over the truck, held up by ties from an A-frame mast.
function buildCrane() {
  const g = new Group()
  const yellow = matte('#f2c21c')
  const dark = matte('#c99a12')
  const steel = matte(C.navy)
  const { legX, legZ, boomY, topY, mastY, reach, tail } = K
  const mid = (reach + tail) / 2
  const long = tail - reach
  for (const z of [-legZ, legZ]) {
    box(g, yellow, 0.42, topY, 0.42, legX, topY / 2, z)
    box(g, matte('#b9b5ad'), 1.1, 0.18, 1.1, legX, 0.09, z)
    for (let y = 2.4; y < topY - 1; y += 2.6) box(g, dark, 0.46, 0.1, 0.46, legX, y, z)
  }
  box(g, yellow, 0.5, 0.5, legZ * 2 + 0.42, legX, topY, 0)
  box(g, yellow, long, 0.5, 0.56, mid, boomY + 0.3, 0)
  box(g, steel, long, 0.08, 0.72, mid, boomY, 0) // the flange the trolley runs under
  for (let x = reach + 0.6; x < tail; x += 1.5) box(g, matte('#12151f'), 0.5, 0.52, 0.58, x, boomY + 0.3, 0, 0, 0, 0.6)
  for (const z of [-0.5, 0.5]) box(g, yellow, 0.2, topY - boomY, 0.2, legX, (boomY + 0.3 + topY) / 2, z)
  box(g, steel, 1.5, 1, 1, tail - 0.8, boomY + 0.3, 0) // counterweight
  box(g, matte('#ec6a1c'), 0.3, 0.3, 0.9, reach + 0.1, boomY + 0.3, 0) // stop at the tip
  const mast = [legX, mastY, 0]
  for (const z of [-legZ, legZ]) tie(g, yellow, [legX, topY, z], mast, 0.26)
  box(g, steel, 0.5, 0.4, 0.5, ...mast)
  tie(g, steel, mast, [reach + 0.6, boomY + 0.56, 0], 0.07)
  tie(g, steel, mast, [(legX + reach) / 2, boomY + 0.56, 0], 0.07)
  tie(g, steel, mast, [tail - 0.6, boomY + 0.8, 0], 0.09)
  return g
}

// What runs along the boom.
function buildTrolley() {
  const g = new Group()
  box(g, matte(C.navy), 1.1, 0.34, 0.9, 0, 0, 0)
  bar(g, matte('#2452de', { roughness: 0.35 }), 0.14, 0.7, 0, -0.02, 0.62, 'x', 10)
  for (const x of [-0.42, 0.42]) for (const z of [-0.42, 0.42]) bar(g, matte('#23252e'), 0.11, 0.1, x, 0.2, z, 'z', 10)
  return g
}

// What hangs from it: the block and a spreader as long as an item. Its origin is the cable's end.
function buildHook() {
  const g = new Group()
  box(g, matte(C.navy), 1.1, 0.26, 0.5, 0, 0, 0)
  box(g, matte('#f2c21c'), 2.2, 0.14, 0.34, 0, -0.2, 0)
  box(g, matte('#12151f'), 0.3, 0.16, 0.36, 0, -0.2, 0)
  return g
}

// One jaw of the grapple, hinged at the spreader. There are two facing at each end of it.
function buildJaw() {
  const g = new Group()
  box(g, matte('#f2c21c'), 0.16, 0.74, 0.1, 0, -0.37, 0)
  box(g, matte('#12151f'), 0.16, 0.1, 0.34, 0, -0.76, 0.14)
  return g
}

function buildKickerPost() {
  const g = new Group()
  const steel = matte(C.navy)
  box(g, steel, 0.42, 2.7, 0.42, POST_X, 1.35, 0)
  box(g, matte('#b9b5ad'), 0.9, 0.16, 0.9, POST_X, 0.08, 0)
  bar(g, matte('#2452de', { roughness: 0.35 }), 0.17, 1.1, POST_X - 0.45, 2.34, 0, 'x', 12)
  for (const x of [POST_X + 0.1, POST_X - 0.98]) bar(g, steel, 0.21, 0.08, x, 2.34, 0, 'x', 12)
  box(g, matte('#12151f'), 0.36, 0.06, 0.36, POST_X, 3.28, 0)
  return g
}

// The paddle, with its rod running back over the guard rail into the cylinder.
function buildRam() {
  const g = new Group()
  bar(g, matte('#d9dbe0'), 0.06, 1.3, 0.65, 2.34, 0, 'x', 8)
  box(g, matte('#f2c21c'), 0.12, 0.66, 1.9, 0, 2.03, 0)
  for (let i = 0; i < 5; i++) box(g, matte('#12151f'), 0.13, 0.2, 0.14, 0, 2.03, -0.76 + i * 0.38, 0, 0.6)
  return g
}

// Hinged at local z = 0, on the guard rail: up out of the way, down across the belt for a kicked
// item to ride.
function buildFlap(len) {
  const g = new Group()
  box(g, matte('#f2c21c'), F.width, 0.08, len + 0.05, 0, 0, -len / 2)
  box(g, matte('#12151f'), F.width, 0.09, 0.14, 0, 0, 0.12 - len)
  return g
}

function createFeed(scene, spec, line, items, trucks, sky) {
  const truck = trucks.list[spec.bay]
  const stage = line.stages[spec.stage]
  const z = stage.z + stage.belt
  const plan = Math.hypot(F.head - L.x, truck.z - z)
  const at = (d) => [L.x + ((F.head - L.x) * d) / plan, z + ((truck.z - z) * d) / plan]
  const [crestX, crestZ] = at(F.climb)
  const [pickX, pickZ] = at(plan - PICK)
  const start = [L.x, L.beltY, z]
  const crest = [crestX, F.top, crestZ]
  const head = [F.head, F.top, truck.z]
  const run = polyline([start, crest, [pickX, F.top, pickZ]])

  const root = new Group()
  root.visible = false
  scene.add(root)
  const solids = []

  // Everything that stands still. The incline's tail starts past the belt it leaves, over the
  // guard rail; the flap bridges the rest.
  const climbLen = Math.hypot(crestX - L.x, F.top - L.beltY, crestZ - z)
  const foot = crest.map((v, i) => start[i] + ((v - start[i]) * F.flap) / climbLen)
  const incline = along(foot, crest)
  const gallery = along(crest, head)
  const yaw = incline.g.rotation.y
  const slope = incline.g.rotation.x
  buildFrame(incline.g, incline.len, true)
  buildFrame(gallery.g, gallery.len, false)
  buildHead(gallery.g, gallery.len / 2)
  bar(incline.g, matte(STEEL), 0.22, F.width, 0, -0.1, -incline.len / 2, 'x', 12) // tail pulley
  const model = new Group()
  model.add(incline.g, gallery.g)
  const bent = (d) => {
    const [x, bz] = at(d)
    const y = d < F.climb ? L.beltY + ((F.top - L.beltY) * d) / F.climb : F.top
    const trestle = buildTrestle(y)
    trestle.position.set(x, 0, bz)
    trestle.rotation.y = yaw
    model.add(trestle)
    for (const side of [-1, 1]) solids.push(solidPole(0.2, y - 0.5, x + Math.cos(yaw) * side, bz - Math.sin(yaw) * side))
  }
  for (const d of F.trestles) bent(d)
  bent(plan - F.headTrestle)
  place(root, model)
  place(root, buildCrane(), 0, truck.z)
  for (const side of [-1, 1]) solids.push(solidPole(0.28, K.topY, K.legX, truck.z + side * K.legZ))

  // The low end is the one part you can walk into.
  const [footX, footZ] = at(2.6)
  solids.push(solidBox(0.95, 1.1, 1.3, footX, 1.1, footZ, yaw))
  solids.push(solidPole(0.3, 2.7, POST_X, z))
  for (const c of solids) c.setEnabled(false)

  // The belt surface, scrolled by its texture's offset.
  const tex = paintBelt()
  tex.wrapS = tex.wrapT = RepeatWrapping
  const mat = new MeshStandardMaterial({ map: tex, roughness: 0.82 })
  for (const section of [incline, gallery]) {
    const geo = new PlaneGeometry(F.width, section.len).rotateX(-Math.PI / 2)
    const uv = geo.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * section.len) / F.cleatEvery)
    const strip = new Mesh(geo, mat)
    strip.position.copy(section.g.position)
    strip.rotation.copy(section.g.rotation)
    strip.translateY(-0.03)
    strip.receiveShadow = true
    root.add(strip)
  }

  place(root, buildKickerPost(), 0, z)
  const ram = place(root, buildRam(), RAM_X, z)
  const flap = place(root, buildFlap(F.flap), foot[0], foot[2], yaw, foot[1] - 0.06)
  flap.rotation.order = 'YXZ'
  const flapUp = slope + 1.3
  flap.rotation.x = flapUp
  const [running, waiting] = ['#39e16e', '#ffb02e'].map((color, i) => {
    const m = neon(color, 2.4)
    box(root, m, 0.32, 0.26, 0.32, POST_X, 2.86 + i * 0.28, z).castShadow = false
    return m
  })
  const glow = (lamp, k) => lamp.color.copy(lamp.userData.base).multiplyScalar(k)

  const trolley = place(root, buildTrolley(), pickX, pickZ, 0, K.boomY - 0.2)
  const hook = place(root, buildHook(), pickX, pickZ, 0, K.lift)
  const jaws = [-1, 1].flatMap((end) =>
    [0, Math.PI].map((turned) => {
      const jaw = place(hook, buildJaw(), end, turned ? 0.2 : -0.2, turned, -0.2)
      jaw.rotation.order = 'YXZ'
      return jaw
    }),
  )
  const cable = box(root, matte('#23252e'), 0.07, 1, 0.07)

  const belt = [] // furthest along first: { item, d }
  const spot = { at: null, yaw: 0, pitch: 0 }
  const hookAt = { x: pickX, y: K.lift, z: pickZ }
  let built = false
  let kick = 0 // s left of the kicker's stroke
  let job = 'rest' // the crane: rest > grab > lift > carry > lower > raise > home
  let held = null // what the crane has
  let grip = 0

  // Moves the hook toward a point; true once it's there.
  function reach(x, y, to, dt) {
    const k = sky.boost * dt
    const dx = x - hookAt.x
    const dy = y - hookAt.y
    const dz = to - hookAt.z
    hookAt.x += Math.sign(dx) * Math.min(Math.abs(dx), K.trolley * k)
    hookAt.y += Math.sign(dy) * Math.min(Math.abs(dy), K.hoist * k)
    hookAt.z += Math.sign(dz) * Math.min(Math.abs(dz), K.trolley * k)
    return hookAt.x === x && hookAt.y === y && hookAt.z === to
  }
  const hang = (item) => items.rest(item) + K.hang
  const JOBS = {
    rest() {
      if (belt[0]?.d >= run.length) job = 'grab'
    },
    grab(dt) {
      const { item } = belt[0]
      if (!reach(pickX, F.top + items.rest(item) + hang(item), pickZ, dt)) return
      held = belt.shift().item
      job = 'lift'
    },
    lift(dt) {
      if (reach(hookAt.x, K.lift, hookAt.z, dt)) job = 'carry'
    },
    // It waits back over the belt if the truck has gone.
    carry(dt) {
      if (!truck.ready) {
        reach(pickX, K.lift, pickZ, dt)
        return
      }
      const to = truck.rig.slot(truck.load)
      if (reach(to.x, K.lift, to.z, dt)) job = 'lower'
    },
    lower(dt) {
      if (!truck.ready) {
        job = 'lift'
        return
      }
      const to = truck.rig.slot(truck.load)
      if (!reach(to.x, to.y + hang(held), to.z, dt)) return
      truck.booked--
      trucks.sell(held, truck, null)
      held = null
      job = 'raise'
    },
    raise(dt) {
      if (reach(hookAt.x, K.lift, hookAt.z, dt)) job = 'home'
    },
    home(dt) {
      if (reach(pickX, K.lift, pickZ, dt)) job = 'rest'
    },
  }

  const out = {
    // Off the end of the machine's belt. True if the kicker takes the item.
    take(item) {
      if (line.queued(spec.stage + 1) < F.backlog || !sky.spare(truck)) return false
      const last = belt.at(-1)
      if (last && last.d < room(item, last.item)) return false
      belt.push({ item, d: 0 })
      truck.booked++
      kick = F.kick
      return true
    },
    build() {
      built = true
      root.visible = true
      stage.feed = out
      for (const c of solids) c.setEnabled(true)
      items.burst(L.x - 1.4, L.beltY + 1, z, 26)
    },
    reset() {
      built = false
      root.visible = false
      belt.length = 0
      kick = 0
      job = 'rest'
      held = null
      Object.assign(hookAt, { x: pickX, y: K.lift, z: pickZ })
      for (const c of solids) c.setEnabled(false)
    },
    update(dt) {
      if (!built) return
      const step = L.speed * sky.boost * dt
      let turning = false
      belt.forEach((b, i) => {
        const ahead = i > 0 ? belt[i - 1].d - room(b.item, belt[i - 1].item) : Infinity
        const d = Math.min(b.d + step, run.length, Math.max(ahead, b.d))
        if (d > b.d) turning = true
        b.d = d
        run.at(d, spot)
        const turn = Math.min(1, d / F.flap) // it swings round to lie along the new belt
        items.add(b.item, spot.at[0], spot.at[1] + items.rest(b.item) / Math.cos(spot.pitch), spot.at[2], spot.yaw * turn, 1, spot.pitch * turn)
      })
      if (turning) tex.offset.y += step / F.cleatEvery

      JOBS[job](dt)
      trolley.position.x = hook.position.x = hookAt.x
      trolley.position.z = hook.position.z = hookAt.z
      hook.position.y = hookAt.y
      cable.position.set(hookAt.x, (K.boomY + hookAt.y) / 2, hookAt.z)
      cable.scale.y = K.boomY - hookAt.y
      grip += ((held ? 1 : 0) - grip) * Math.min(1, dt * 14)
      for (const jaw of jaws) jaw.rotation.x = 0.5 * (1 - grip)
      if (held) items.add(held, hookAt.x, hookAt.y - hang(held), hookAt.z, Math.PI / 2)

      kick = Math.max(0, kick - dt)
      ram.position.x = RAM_X - STROKE * (kick > 0 ? Math.sin((1 - kick / F.kick) * Math.PI) : 0)
      flap.rotation.x += ((kick > 0 ? slope : flapUp) - flap.rotation.x) * Math.min(1, dt * 16)
      const stuck = !truck.ready && (held || belt[0]?.d >= run.length)
      glow(running, !stuck && (turning || job !== 'rest') ? 2.2 : 0.35)
      glow(waiting, stuck ? 2.2 : 0.3)
    },
  }
  return out
}

export function buildFeeds(scene, line, items, trucks, sky) {
  const list = F.list.map((spec) => createFeed(scene, spec, line, items, trucks, sky))
  return {
    // Builds conveyer i and says what it does, for the HUD.
    build(i) {
      list[i].build()
      return F.list[i].note
    },
    reset() {
      for (const f of list) f.reset()
    },
    update(dt) {
      for (const f of list) f.update(dt)
    },
  }
}
