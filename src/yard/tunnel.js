import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping } from 'three'
import * as sfx from '../audio/sfx.js'
import { shake } from '../camera.js'
import { AIR, YARD } from '../config.js'
import { createEmitter } from '../particles.js'
import { RAPIER, addFixed } from '../physics.js'
import { neon, solidBox } from '../propkit.js'
import { along } from './feeds.js'
import { bar, box, matte, picture, place } from './kit.js'
import { polyline } from './line.js'
import { paintBanner, paintBelt, paintHazard, paintTunnelFloor, paintTunnelRoof, paintTunnelWall } from './paint.js'

// The way to the airstrip: a trench down out of the forest under a timber hatch, a tunnel under the
// fence and the far trees, a trench up onto the apron. Dig Tunnel blows the hatch off. The tunnel
// itself is unlit by anything real: its lamps' light is painted on its walls, which costs nothing on
// a phone and stays the same day and night. A shadow-casting roof keeps the sun off whoever is in it.
// The Tunnel Conveyor runs through all of it; until it is bought the crew carries the logs by hand.
const T = AIR.tunnel
const B = AIR.belt
const { colors: C } = YARD
const NORTH = T.z - T.half
const SOUTH = T.z + T.half
const WIDTH = T.half * 2
const HEIGHT = T.roof - T.floor
const STEEL = '#8f949c'
const TIMBER = '#4a3324'
const FLOOR_DEPTH = -T.floor

// A floor-level flat rectangle's mesh, rotated to face the way it is seen from.
function plane(scene, mat, w, h, x, y, z, rx = 0, ry = 0) {
  const m = new Mesh(new PlaneGeometry(w, h), mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, 0, 'YXZ')
  scene.add(m)
  return m
}

function repeating(tex, u, v) {
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(u, v)
  return new MeshBasicMaterial({ map: tex })
}

// A slab whose top surface runs from (ax, ay) to (bx, by), `half` either side of T.z.
function ramp(ax, ay, bx, by, half = T.half + 0.2, z = T.z, thick = 0.5) {
  const a = Math.atan2(by - ay, bx - ax)
  const len = Math.hypot(bx - ax, by - ay)
  const x = (ax + bx) / 2 + Math.sin(a) * thick
  const y = (ay + by) / 2 - Math.cos(a) * thick
  return addFixed(RAPIER.ColliderDesc.cuboid(len / 2 + 0.05, thick, half), { x, y, z }, { x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) })
}

// The inside: rock, roof and floor of the bored part, and the ribs and lamps along it.
function buildBore(scene) {
  const len = T.east - T.portal
  const mid = (T.portal + T.east) / 2
  const sets = Math.round(len / T.lampEvery)
  const y = (T.floor + T.roof) / 2
  plane(scene, repeating(paintTunnelFloor(), sets, 1), len, WIDTH, mid, T.floor + 0.01, T.z, -Math.PI / 2)
  const wall = repeating(paintTunnelWall(), sets, 1)
  plane(scene, wall, len, HEIGHT, mid, y, NORTH + 0.01)
  plane(scene, wall, len, HEIGHT, mid, y, SOUTH - 0.01, 0, Math.PI)
  const roof = plane(scene, repeating(paintTunnelRoof(), sets, 1), len, WIDTH, mid, T.roof - 0.01, T.z, Math.PI / 2)
  roof.castShadow = true

  const g = new Group()
  const wood = matte(TIMBER)
  const lamp = neon('#ffc877', 3.2)
  const cable = matte('#17181d')
  const step = len / sets
  for (let i = 0; i < sets; i++) {
    const x = T.portal + step * (i + 0.5)
    for (const z of [NORTH + 0.2, SOUTH - 0.2]) {
      box(g, wood, 0.34, HEIGHT, 0.34, x + step / 2, y, z)
      box(g, wood, 0.5, 0.5, 0.42, x + step / 2, T.roof - 0.7, z + (z < T.z ? 0.25 : -0.25), 0, 0, 0)
    }
    box(g, wood, 0.36, 0.4, WIDTH, x + step / 2, T.roof - 0.2, T.z)
    box(g, matte('#2b2a2e'), 0.2, 0.18, 0.2, x, T.roof - 0.12, T.z)
    box(g, lamp, 0.26, 0.16, 0.4, x, T.roof - 0.3, T.z)
  }
  box(g, cable, len, 0.05, 0.05, mid, T.roof - 0.1, T.z)
  // An old mine rail along the south side, half buried.
  for (const z of [SOUTH - 1.6, SOUTH - 0.8]) box(g, matte('#3c3f47'), len, 0.08, 0.08, mid, T.floor + 0.05, z)
  for (let x = T.portal + 1; x < T.east; x += 1.8) box(g, wood, 0.34, 0.06, 1.5, x, T.floor + 0.03, SOUTH - 1.2)
  place(scene, g)
}

// One trench, `low` being its x at tunnel level and `high` at lawn level.
function buildTrench(scene, low, high, title) {
  const g = new Group()
  const sign = Math.sign(high - low)
  const len = Math.abs(high - low)
  const mid = (low + high) / 2
  const slope = Math.hypot(len, FLOOR_DEPTH)
  const pitch = Math.atan2(FLOOR_DEPTH, len)
  const concrete = new MeshStandardMaterial({ color: '#8f8c86', roughness: 0.95 })
  const floor = new MeshStandardMaterial({ color: '#5e5a54', roughness: 1 })
  const surface = plane(scene, floor, slope, WIDTH, mid, T.floor / 2 + 0.01, T.z)
  surface.rotation.set(-Math.PI / 2, 0, 0)
  surface.rotateY(-sign * pitch)
  surface.receiveShadow = true
  for (const [z, ry] of [[NORTH + 0.01, 0], [SOUTH - 0.01, Math.PI]]) plane(scene, concrete, len, FLOOR_DEPTH, mid, T.floor / 2, z, 0, ry).receiveShadow = true
  // Over the mouth: the lintel, a banner and columns either side.
  const lintel = plane(scene, concrete, WIDTH, -T.roof, low, T.roof / 2, T.z, 0, sign > 0 ? Math.PI / 2 : -Math.PI / 2)
  lintel.receiveShadow = true

  const yellow = matte(C.guardRail)
  const steel = matte('#2d3a55')
  const kerb = matte('#c9c6be')
  const face = low + sign * 0.14
  for (const z of [NORTH + 0.45, SOUTH - 0.45]) box(g, matte('#a5a29a'), 0.9, HEIGHT - T.roof + 0.4, 0.9, low + sign * 0.45, (T.floor + 0.3) / 2, z)
  box(g, matte('#a5a29a'), 1, 0.8, WIDTH + 1.4, low + sign * 0.5, 0.25, T.z)
  picture(g, paintBanner(title, { bg: '#2b3040', edge: '#f2c21c', w: 640, h: 96 }), 6.2, 0.9, face, T.roof / 2 + 0.05, T.z, sign > 0 ? Math.PI / 2 : -Math.PI / 2)
  for (const z of [NORTH - 0.25, SOUTH + 0.25]) {
    box(g, kerb, len + 0.6, 0.3, 0.5, mid, 0.13, z)
    box(g, yellow, len + 0.6, 0.1, 0.1, mid, 1.15, z)
    box(g, yellow, len + 0.6, 0.08, 0.08, mid, 0.68, z)
    for (let i = 0; i <= Math.round(len / 2.2); i++) box(g, steel, 0.1, 1.16, 0.1, Math.min(low, high) - 0.3 + ((len + 0.6) * i) / Math.round(len / 2.2), 0.6, z)
    solidBox(len / 2 + 0.3, 0.8, 0.3, mid, 0.8, z)
  }
  place(scene, g)
  // Below the lawn these walls are what stops you: the floor's own cuboid only goes down to the roof.
  for (const z of [NORTH - 0.4, SOUTH + 0.4]) solidBox(len / 2 + 0.4, FLOOR_DEPTH / 2 + 0.5, 0.4, mid, T.floor / 2 - 0.5, z)
}

// The timber lid over the mouth. A neighbour's yard only ever has this.
function buildHatch() {
  const g = new Group()
  const len = T.portal - T.west
  const mid = (T.west + T.portal) / 2
  const wood = matte(C.wood)
  const dark = matte(C.woodDark)
  for (let i = 0; i < 12; i++) box(g, i % 2 ? wood : matte('#a56c3c'), len, 0.1, WIDTH / 12 - 0.04, mid, 0.1, NORTH + (WIDTH / 12) * (i + 0.5))
  for (const x of [T.west + 1, mid, T.portal - 1]) box(g, dark, 0.5, 0.14, WIDTH, x, 0.17, T.z)
  const hazard = new MeshBasicMaterial({ map: paintHazard() })
  for (const z of [NORTH + 0.2, SOUTH - 0.2]) box(g, hazard, len, 0.04, 0.34, mid, 0.26, z)
  for (const x of [T.west + 0.2, T.portal - 0.2]) box(g, hazard, 0.34, 0.04, WIDTH, x, 0.26, T.z)
  bar(g, matte(STEEL), 0.34, 0.1, mid, 0.3, T.z, 'y', 16)
  return g
}

// The neighbours' copy: the lid over solid ground.
export function buildClosedHatch(scene) {
  place(scene, buildHatch())
}

// The steel funnel the crew tips logs into, and the belt's own kit along one straight run.
function buildHopper(g, x, y, z) {
  const skin = matte('#566072', { roughness: 0.5, metalness: 0.3 })
  const rim = matte(C.guardRail)
  box(g, skin, 2.3, 0.14, 0.14, x, y + 1, z - 1.05)
  box(g, skin, 2.3, 0.14, 0.14, x, y + 1, z + 1.05)
  box(g, skin, 0.14, 0.14, 2.2, x - 1.1, y + 1, z)
  box(g, rim, 2.4, 0.08, 2.4, x, y + 1.1, z)
  box(g, skin, 2.2, 0.9, 0.1, x, y + 0.55, z - 0.92, 0, 0.3)
  box(g, skin, 2.2, 0.9, 0.1, x, y + 0.55, z + 0.92, 0, -0.3)
  box(g, skin, 0.1, 0.9, 1.8, x - 1, y + 0.55, z, 0, 0, -0.3)
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, matte(C.navy), 0.16, y + 1, 0.16, x + lx, (y + 1) / 2, z + lz)
}

export function buildRun(g, len) {
  const steel = matte(C.navy)
  const roller = matte(STEEL)
  const rail = matte(C.guardRail)
  const edge = B.width / 2 + 0.08
  for (const x of [-edge, edge]) {
    box(g, steel, 0.14, 0.3, len, x, -0.2, 0)
    box(g, rail, 0.08, 0.08, len, x, 0.12, 0)
  }
  box(g, matte('#23262f'), B.width + 0.1, 0.05, len, 0, -0.1, 0)
  for (let z = -len / 2 + 0.5; z < len / 2; z += 1.5) bar(g, roller, 0.08, B.width, 0, -0.26, z, 'x', 8)
  for (let z = -len / 2 + 1; z < len / 2; z += 4.5) {
    for (const x of [-edge, edge]) box(g, steel, 0.12, 0.8, 0.12, x, -0.7, z)
    box(g, steel, B.width + 0.4, 0.1, 0.1, 0, -0.42, z)
  }
}

export function buildTunnel(scene, { items, bursts }) {
  buildBore(scene)
  buildTrench(scene, T.portal, T.west, 'TO THE AIRSTRIP')
  buildTrench(scene, T.east, T.top, 'TO THE YARD')

  // Walkable: the two ramps, the floor, and the walls below the lawn's own collider.
  ramp(T.west, 0, T.portal, T.floor)
  ramp(T.east, T.floor, T.top, 0)
  const len = T.east - T.portal
  const mid = (T.portal + T.east) / 2
  solidBox(len / 2 + 0.2, 0.5, T.half + 0.4, mid, T.floor - 0.5, T.z)
  for (const z of [NORTH - 0.3, SOUTH + 0.3]) solidBox(len / 2 + 0.2, HEIGHT / 2 + 0.5, 0.3, mid, (T.floor + T.roof) / 2, z)

  const hatch = place(scene, buildHatch())
  const lid = solidBox((T.portal - T.west) / 2, 0.14, T.half + 0.1, (T.west + T.portal) / 2, 0.14, T.z)

  // The tunnel's air: dust hanging under the lamps, drops falling out of the roof.
  createEmitter(scene, {
    boxes: [{ x: mid, y: -3.8, z: T.z, sx: len / 2, sy: 1.8, sz: T.half - 0.4 }],
    count: AIR.fx.motes,
    life: 7,
    velocity: [0.12, 0.06, 0],
    spread: [0.25, 0.12, 0.25],
    size: 0.09,
    color: '#ffd9a0',
    intensity: 1.1,
    opacity: 0.8,
    seed: 71,
  })
  createEmitter(scene, {
    boxes: [{ x: mid, y: T.roof - 0.3, z: T.z, sx: len / 2, sy: 0.05, sz: T.half - 0.6 }],
    count: AIR.fx.drips,
    life: 1.1,
    velocity: [0, 0, 0],
    gravity: 5.6,
    size: 0.07,
    color: '#bcd8ff',
    intensity: 1.4,
    opacity: 0.9,
    seed: 72,
  })

  // The Tunnel Conveyor, absent until bought.
  const run = polyline(B.path)
  const belt = new Group()
  belt.visible = false
  scene.add(belt)
  const solids = []
  const frame = new Group()
  const legs = B.path.slice(1).map((b, i) => along(B.path[i], b))
  for (const { g, len: l } of legs) {
    buildRun(g, l)
    frame.add(g)
  }
  const [head] = B.path
  buildHopper(frame, head[0] - 0.1, head[1], head[2])
  place(belt, frame)
  const tex = paintBelt()
  tex.wrapS = tex.wrapT = RepeatWrapping
  const mat = new MeshStandardMaterial({ map: tex, roughness: 0.82 })
  for (const leg of legs) {
    const geo = new PlaneGeometry(B.width, leg.len).rotateX(-Math.PI / 2)
    const uv = geo.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * leg.len) / B.cleatEvery)
    const strip = new Mesh(geo, mat)
    strip.position.copy(leg.g.position)
    strip.rotation.copy(leg.g.rotation)
    strip.translateY(-0.03)
    strip.receiveShadow = true
    belt.add(strip)
  }
  B.path.slice(1).forEach(([bx, by, bz], i) => {
    const [ax, ay] = B.path[i]
    if (ay === by) solids.push(solidBox(Math.abs(bx - ax) / 2, 0.6, B.width / 2 + 0.1, (ax + bx) / 2, by - 0.6, bz))
    else solids.push(ramp(ax, ay - 0.35, bx, by - 0.35, B.width / 2 + 0.1, bz, 0.7))
  })
  solids.push(solidBox(1.2, 1.2, 1.2, head[0] - 0.1, 1.2, head[2]))
  for (const c of solids) c.setEnabled(false)

  const spot = { at: null, yaw: 0, pitch: 0 }
  const list = [] // furthest along first: { item, d }
  let boost = 1
  let moved = false
  let chipLeft = 0

  function blast() {
    const x = (T.west + T.portal) / 2
    for (let i = 0; i < AIR.fx.blast; i++) {
      const a = Math.random() * Math.PI * 2
      const k = Math.random()
      bursts.dust.spawn({ x: x + (Math.random() - 0.5) * 9, y: 0.4, z: T.z + (Math.random() - 0.5) * 7, vx: Math.cos(a) * k * 7, vy: 5 + Math.random() * 14, vz: Math.sin(a) * k * 7, life: 1.8 + Math.random() * 2, size: 1.2 + Math.random() * 1.6, grow: 3.2, color: i % 3 ? '#8d7e69' : '#b09c80', opacity: 0.8, gravity: 2.4, drag: 1.2 })
    }
    for (let i = 0; i < 40; i++) bursts.flames.spawn({ x: x + (Math.random() - 0.5) * 6, y: 0.6, z: T.z + (Math.random() - 0.5) * 5, vx: (Math.random() - 0.5) * 16, vy: 6 + Math.random() * 14, vz: (Math.random() - 0.5) * 16, life: 0.5 + Math.random() * 0.5, size: 0.3 + Math.random() * 0.3, color: i % 2 ? '#ffb02e' : '#ffe08a', gravity: 14 })
    items.burst(x, 1, T.z, 60)
    sfx.blast(x, T.z)
    shake(0.9)
  }

  const out = {
    get moving() {
      return moved
    },
    get owned() {
      return belt.visible
    },
    get open() {
      return !hatch.visible
    },
    // How many logs ride it now, and how many more it could take.
    get riding() {
      return list.length
    },
    // Dug: `quiet` for a save being loaded.
    dig(quiet) {
      hatch.visible = false
      lid.setEnabled(false)
      if (!quiet) blast()
    },
    buildBelt() {
      belt.visible = true
      for (const c of solids) c.setEnabled(true)
    },
    setBoost(k) {
      boost = k
    },
    get boost() {
      return boost
    },
    // Puts an item on at the hopper, if the last one has moved far enough on. `hide` = s it is still
    // in the air on its way down there, drawn by whoever threw it.
    take(item, hide = 0) {
      if (list.length && list[list.length - 1].d < B.gap) return false
      list.push({ item, d: 0, hide })
      return true
    },
    reset() {
      hatch.visible = true
      lid.setEnabled(true)
      belt.visible = false
      for (const c of solids) c.setEnabled(false)
      list.length = 0
      boost = 1
    },
    // `land(item, from)` takes a log off the end, or says false and the belt backs up.
    update(dt, land) {
      if (!belt.visible) return
      moved = false
      const step = B.speed * boost * dt
      for (let i = 0; i < list.length; i++) {
        const b = list[i]
        const limit = i ? Math.max(b.d, list[i - 1].d - B.gap) : Infinity
        const next = Math.min(b.d + step, limit, run.length)
        if (next > b.d) moved = true
        b.d = next
        if (b.d >= run.length && !i) {
          run.at(b.d, spot)
          if (land(b.item, { x: spot.at[0], y: spot.at[1] + 0.5, z: spot.at[2] })) {
            list.shift()
            i--
          }
        }
      }
      for (const b of list) {
        if (b.hide > 0) {
          b.hide -= dt
          continue
        }
        run.at(b.d, spot)
        items.add(b.item, spot.at[0], spot.at[1] + items.rest(b.item) / Math.cos(spot.pitch), spot.at[2], spot.yaw, 1, spot.pitch)
      }
      if (moved) {
        tex.offset.y += step / B.cleatEvery
        chipLeft -= dt
        if (chipLeft <= 0 && list.length) {
          chipLeft = 0.14
          const b = list[Math.floor(Math.random() * list.length)]
          run.at(b.d, spot)
          bursts.dust.spawn({ x: spot.at[0], y: spot.at[1] + 0.3, z: spot.at[2] + (Math.random() - 0.5) * 0.6, vy: 0.6, life: 0.9, size: 0.16, grow: 2, color: '#c9a878', opacity: 0.55, gravity: 0.4 })
        }
      }
    },
    // 0 up in the open, 1 at the bottom of the tunnel: how far under the lawn this point is.
    depth: (p) => Math.max(0, Math.min(1, -p.y / FLOOR_DEPTH)),
    // The nearest point of the belt to (x, z), for its sound.
    nearest(x, z, to) {
      to.x = Math.max(head[0], Math.min(B.path.at(-1)[0], x))
      to.z = head[2]
      to.y = to.x > T.portal && to.x < T.east ? T.floor : 0.95
      return to
    },
  }
  return out
}
