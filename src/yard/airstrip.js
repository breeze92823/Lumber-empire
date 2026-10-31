import { BoxGeometry, DoubleSide, ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, RepeatWrapping, Shape } from 'three'
import * as sfx from '../audio/sfx.js'
import { AIR, COARSE_POINTER, YARD } from '../config.js'
import { createBursts } from '../particles.js'
import { neon, solidBox } from '../propkit.js'
import { routeBack, routeOut, createPlanes } from './aircraft.js'
import { buildAirLinks } from './airLinks.js'
import { bar, box, matte, picture, place, silhouette } from './kit.js'
import { paintBanner, paintBelt, paintChainLink, paintGroundText } from './paint.js'
import { buildTunnel } from './tunnel.js'

// The airport east of the forest, and everything that gets wood into a freighter. Logs arrive at the
// bunker by hand (the crew's every AIR.crewEvery-th worker, walking the tunnel), and once the Tunnel
// Conveyor stands so does anything the line sends down an Air Link (airLinks.js). A telescopic boom
// reaches out to a parked plane's ramp and carries it all aboard. Until the Airport is bought the
// buildings are silhouettes and the lights are off. Stands in the player's own yard only.
const T = AIR.tunnel
const G = AIR.compound
const R = AIR.runway
const K = AIR.pile
const LD = AIR.loader
const dummy = new Object3D()
const unit = new BoxGeometry(1, 1, 1)
const FLAT = -Math.PI / 2
const BOOM = 14 // m the boom's model is built at
const SHOW_ROW = 6 // items across the bunker

function instanced(scene, mat, list, shadow = false) {
  const m = new InstancedMesh(unit, mat, list.length)
  m.castShadow = shadow
  m.receiveShadow = true
  list.forEach(([x, y, z, sx, sy, sz, yaw = 0, roll = 0], i) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, yaw, roll)
    dummy.scale.set(sx, sy, sz)
    dummy.updateMatrix()
    m.setMatrixAt(i, dummy.matrix)
  })
  scene.add(m)
  return m
}

// The paint on the apron and runway (the surfaces themselves are in world.js).
function buildPaint(scene) {
  const white = []
  const yellow = []
  const y = 0.02
  const paint = (list, x, z, sx, sz, yaw = 0) => list.push([x, y, z, sx, 0.024, sz, yaw])
  for (const z of [R.z - R.half + 0.7, R.z + R.half - 0.7]) paint(white, (R.west + R.east) / 2, z, R.east - R.west - 4, 0.5)
  for (let x = R.west + 40; x < R.east - 34; x += R.dashEvery) paint(white, x, R.z, 11, 0.7)
  for (const [from, dir] of [[R.west + 2, 1], [R.east - 2, -1]]) {
    for (let i = 0; i < 10; i++) paint(white, from + dir * 8, R.z + (i - 4.5) * 1.9, 16, 1.2)
    for (const dist of [74, 112]) for (const side of [-1, 1]) paint(white, from + dir * dist, R.z + side * 4.8, 20, 2.6)
  }
  // The taxi line, in dashes round the bends.
  const stop = AIR.stand.lip + 20
  for (const way of [routeOut(stop), routeBack(stop)]) {
    const at = { at: null, yaw: 0 }
    const from = way.bend ? way.bend - 2 : 0
    for (let d = from; d < way.length; d += 2.6) {
      way.at(d, at)
      if (at.at[2] > R.z - R.half + 2) continue
      paint(yellow, at.at[0], at.at[2], 0.4, 1.6, at.yaw)
    }
  }
  // The stand's box, wide enough for the biggest plane, and the hold bar on the runway's edge.
  const { z: sz } = AIR.stand
  const half = AIR.planes.titan.span / 2 + 1
  for (const z of [sz - half, sz + 25.5]) paint(yellow, 138, z, 66, 0.34)
  for (const x of [105, 171]) paint(yellow, x, (sz - half + sz + 25.5) / 2, 0.34, half + 25.5)
  paint(yellow, AIR.taxi.hold - 2, R.z - R.half - 1, 0.8, 7)
  instanced(scene, matte('#f2f1ea'), white)
  instanced(scene, matte(AIR.apron.line), yellow)

  // The runway's numbers, each read from its own end.
  for (const [text, x, yaw] of [['09', R.west + 34, -Math.PI / 2], ['27', R.east - 34, Math.PI / 2]]) {
    const m = new Mesh(new PlaneGeometry(16, 16), new MeshBasicMaterial({ map: paintGroundText(text), transparent: true, depthWrite: false }))
    m.rotation.set(FLAT, 0, yaw, 'YXZ')
    m.position.set(x, 0.03, R.z)
    scene.add(m)
  }
}

// The perimeter: steel posts, chain link, a leaning top with three strands of wire. It goes all the
// way round, so the only way in is the tunnel and no wing has to pass through a gap.
function buildFence(scene) {
  const posts = []
  const rails = []
  const arms = []
  const wires = []
  const tex = paintChainLink()
  tex.wrapS = tex.wrapT = RepeatWrapping
  const mesh = new MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: DoubleSide, roughness: 0.5, metalness: 0.4 })
  const H = G.height
  const run = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.round(len / G.postEvery)
    const yaw = Math.atan2(-(bz - az), bx - ax)
    const out = [Math.sin(yaw), Math.cos(yaw)] // towards the outside, for the arms below
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n
      const z = az + ((bz - az) * i) / n
      posts.push([x, H / 2, z, 0.18, H, 0.18])
      arms.push([x + out[0] * 0.28, H + 0.24, z + out[1] * 0.28, 0.08, 0.8, 0.08, yaw, 0.75 * (out[0] > 0.5 ? 1 : out[0] < -0.5 ? -1 : 0)])
    }
    for (const y of [0.14, H * 0.5, H]) rails.push([(ax + bx) / 2, y, (az + bz) / 2, len, 0.07, 0.07, yaw])
    for (const k of [0.2, 0.36, 0.52]) wires.push([(ax + bx) / 2 + out[0] * k, H + k * 0.94, (az + bz) / 2 + out[1] * k, len, 0.03, 0.03, yaw])
    const link = tex.clone()
    link.needsUpdate = true
    link.repeat.set(len / 0.9, H / 0.9)
    const m = new Mesh(new PlaneGeometry(len, H), mesh.clone())
    m.material.map = link
    m.position.set((ax + bx) / 2, H / 2, (az + bz) / 2)
    m.rotation.y = yaw
    scene.add(m)
  }
  run(G.west, G.north, G.east, G.north)
  run(G.west, G.south, G.east, G.south)
  run(G.west, G.north, G.west, G.south)
  run(G.east, G.north, G.east, G.south)
  instanced(scene, matte('#7d8590'), posts, true)
  instanced(scene, matte('#a6adb6', { roughness: 0.4, metalness: 0.3 }), rails, true)
  instanced(scene, matte('#7d8590'), arms)
  instanced(scene, matte('#c9ced8', { roughness: 0.35, metalness: 0.5 }), wires)
  const hy = G.block / 2
  const wide = (G.east - G.west) / 2
  const mid = (G.east + G.west) / 2
  const deep = (G.south - G.north) / 2
  const midZ = (G.south + G.north) / 2
  solidBox(wide, hy, 0.25, mid, hy, G.north)
  solidBox(wide, hy, 0.25, mid, hy, G.south)
  solidBox(0.25, hy, deep, G.west, hy, midZ)
  solidBox(0.25, hy, deep, G.east, hy, midZ)
}

function buildHangar() {
  const H = AIR.hangar
  const g = new Group()
  const wall = 10
  const outline = (w, h) => {
    const s = new Shape()
    s.moveTo(-w / 2, 0)
    s.lineTo(-w / 2, wall)
    s.quadraticCurveTo(0, h * 2 - wall, w / 2, wall)
    s.lineTo(w / 2, 0)
    s.closePath()
    return s
  }
  const skin = new Mesh(new ExtrudeGeometry(outline(H.w, H.h), { depth: H.d, bevelEnabled: false, curveSegments: 18 }).translate(0, 0, -H.d / 2), matte('#d7dadf', { roughness: 0.6 }))
  g.add(skin)
  const rib = new ExtrudeGeometry(outline(H.w + 0.6, H.h + 0.4), { depth: 0.4, bevelEnabled: false, curveSegments: 18 })
  const ribs = matte('#2f6cc0', { roughness: 0.5 })
  for (let i = 0; i <= 4; i++) {
    const m = new Mesh(rib, ribs)
    m.position.z = -H.d / 2 + (i * H.d) / 4 - 0.2
    g.add(m)
  }
  // The open door: a dark hall with the rolled-back leaves either side.
  const front = H.d / 2 + 0.2
  const hall = H.w - 11
  box(g, matte('#191c24'), hall, 13.4, 0.1, 0, 6.7, front)
  box(g, matte('#2d323e'), hall, 0.7, 0.2, 0, 13.7, front + 0.04)
  for (const side of [-1, 1]) {
    box(g, matte('#f0f1f3'), 4.8, 14, 0.5, side * (H.w / 2 - 2.6), 7, front + 0.1)
    box(g, matte('#f2c21c'), 4.9, 0.7, 0.52, side * (H.w / 2 - 2.6), 1.2, front + 0.1)
    box(g, matte('#1b1c22'), 4.9, 0.2, 0.53, side * (H.w / 2 - 2.6), 1.7, front + 0.1)
  }
  for (let x = -21; x <= 21; x += 7) box(g, neon('#ffeac2', 2.4), 3.6, 0.2, 0.22, x, 12.6, front + 0.2)
  picture(g, paintBanner('LUMBER AIR CARGO', { bg: '#1d46c2', edge: '#f2c21c', fill: '#ffffff', w: 1024, h: 128 }), 26, 3.2, 0, 16, front + 0.3)
  return g
}

function buildTanks() {
  const g = new Group()
  const white = matte('#eceff2')
  const steel = matte('#6b7180')
  for (const x of [-4.4, 4.4]) {
    bar(g, white, 3, 12, x, 3.6, 0, 'z', 18)
    for (const z of [-4.4, 4.4]) box(g, steel, 4.4, 1.2, 0.6, x, 0.6, z)
    for (const z of [-3.6, 0, 3.6]) bar(g, matte('#f2c21c'), 3.04, 0.16, x, 3.6, z, 'z', 18)
  }
  box(g, steel, 11, 0.24, 0.24, 0, 1.1, 6.8)
  bar(g, steel, 0.18, 4, 4.4, 0.8, 8.6, 'z', 8)
  box(g, matte('#ac2a2f'), 1.2, 2, 0.9, 4.4, 1, 10.8)
  return g
}

// A floodlight on its mast.
function buildMast() {
  const g = new Group()
  box(g, matte('#a5a29a'), 1.2, 0.5, 1.2, 0, 0.25, 0)
  bar(g, matte('#8a93a0'), 0.22, 18, 0, 9, 0, 'y', 8)
  box(g, matte('#2d3a55'), 3.4, 1.1, 0.4, 0, 18.2, 0)
  return g
}

// The apron's odds and ends: nothing a wing reaches.
function buildClutter() {
  const g = new Group()
  const cone = (x, z) => {
    box(g, matte('#ec6a1c'), 0.62, 0.08, 0.62, x, 0.05, z)
    bar(g, matte('#ec6a1c'), 0.15, 0.68, x, 0.42, z, 'y', 8)
    box(g, matte('#f6f2e8'), 0.34, 0.1, 0.34, x, 0.4, z)
  }
  for (let z = 14; z < 29; z += 3) cone(92, z)
  for (let x = 180; x < 232; x += 8) cone(x, -18)
  const crate = (x, y, z, s, yaw = 0) => {
    box(g, matte('#b08050'), s, s, s, x, y + s / 2, z, yaw)
    for (const dy of [0.08, s - 0.08]) box(g, matte('#6e4229'), s + 0.04, 0.1, s + 0.04, x, y + dy, z, yaw)
  }
  crate(112, 0, -19, 1.6)
  crate(113.9, 0, -18.4, 1.3, 0.4)
  crate(112.6, 1.6, -19, 1, 0.3)
  // A tow tug and a fuel bowser, parked up.
  const P = [190, -24]
  box(g, matte('#f2c21c'), 2.6, 1, 4.4, P[0], 1, P[1])
  box(g, matte('#23252e'), 2, 1.1, 1.6, P[0], 2, P[1] - 0.9)
  for (const x of [P[0] - 1.4, P[0] + 1.4]) for (const z of [P[1] - 1.4, P[1] + 1.4]) bar(g, matte('#15161c'), 0.55, 0.42, x, 0.55, z, 'x', 12)
  const Q = [178, -28]
  box(g, matte('#ac2a2f'), 2.6, 1.4, 2.4, Q[0], 1.4, Q[1] + 3)
  bar(g, matte('#eceff2'), 1.25, 5.4, Q[0], 2, Q[1] - 1, 'z', 14)
  for (const z of [Q[1] - 3, Q[1] + 0.2, Q[1] + 3]) for (const x of [Q[0] - 1.3, Q[0] + 1.3]) bar(g, matte('#15161c'), 0.6, 0.44, x, 0.6, z, 'x', 12)
  return g
}

// The ground crewman who brings it in: two lit wands and a hi-vis coat.
function buildMarshal() {
  const g = new Group()
  const coat = matte('#d8f03a')
  const legs = matte('#1f3a8c')
  box(g, coat, 0.8, 0.8, 0.42, 0, 1.25, 0).castShadow = true
  box(g, matte('#e6c99a'), 0.44, 0.44, 0.44, 0, 1.88, 0)
  box(g, matte('#f6f2e8'), 0.56, 0.2, 0.56, 0, 2.18, 0)
  box(g, legs, 0.34, 0.86, 0.38, -0.2, 0.43, 0)
  box(g, legs, 0.34, 0.86, 0.38, 0.2, 0.43, 0)
  const arms = [-1, 1].map((side) => {
    const pivot = new Group()
    pivot.position.set(side * 0.56, 1.6, 0)
    box(pivot, coat, 0.28, 0.8, 0.28, 0, -0.4, 0)
    box(pivot, neon('#ff6a1c', 3), 0.1, 0.8, 0.1, 0, -1.1, 0)
    g.add(pivot)
    return pivot
  })
  return { g, arms }
}

// The bunker: heavy steel walls round a concrete floor, open at the top.
function buildBunker() {
  const g = new Group()
  const steel = matte('#566072', { roughness: 0.5, metalness: 0.3 })
  const rib = matte(YARD.colors.navy)
  const { x, z, w, d, wall } = K
  box(g, matte('#a5a29a'), w + 0.8, 0.2, d + 0.8, x, 0.1, z)
  for (const side of [-1, 1]) {
    box(g, steel, w, wall, 0.2, x, wall / 2 + 0.1, z + (side * d) / 2)
    box(g, steel, 0.2, wall, d, x + (side * w) / 2, wall / 2 + 0.1, z)
    box(g, matte(YARD.colors.guardRail), w + 0.2, 0.14, 0.26, x, wall + 0.14, z + (side * d) / 2)
    box(g, matte(YARD.colors.guardRail), 0.26, 0.14, d + 0.2, x + (side * w) / 2, wall + 0.14, z)
    for (const k of [-0.33, 0, 0.33]) {
      box(g, rib, 0.16, wall, 0.1, x + k * w, wall / 2 + 0.1, z + side * (d / 2 + 0.14))
      box(g, rib, 0.1, wall, 0.16, x + side * (w / 2 + 0.14), wall / 2 + 0.1, z + k * d)
    }
  }
  return g
}

function buildBoom(tex) {
  const g = new Group()
  const steel = matte(YARD.colors.navy)
  const rail = matte(YARD.colors.guardRail)
  const half = LD.width / 2 + 0.1
  for (const x of [-half, half]) {
    box(g, steel, 0.16, 0.36, BOOM, x, -0.24, 0)
    box(g, rail, 0.08, 0.08, BOOM, x, 0.34, 0)
    for (let z = -BOOM / 2 + 0.6; z <= BOOM / 2; z += 1.6) box(g, rail, 0.07, 0.36, 0.07, x, 0.15, z)
  }
  for (let z = -BOOM / 2 + 0.5; z < BOOM / 2; z += 1.2) bar(g, matte('#8f949c'), 0.08, LD.width, 0, -0.28, z, 'x', 8)
  // A wheeled leg under its end, that rolls with it.
  box(g, steel, 2.2, 0.2, 0.3, 0, -0.5, BOOM / 2 - 1.4)
  const baked = place(new Group(), g)
  const geo = new PlaneGeometry(LD.width, BOOM).rotateX(FLAT)
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * BOOM) / 1.2)
  const surface = new Mesh(geo, new MeshStandardMaterial({ map: tex, roughness: 0.82 }))
  surface.position.y = -0.03
  baked.add(surface)
  return baked
}

export function buildAir(root, { items, lighting, stats, trucks, lines }) {
  const bursts = { dust: createBursts(root, { count: AIR.fx.dust }), flames: createBursts(root, { count: AIR.fx.flames, additive: true, intensity: 2.2 }) }
  const tunnel = buildTunnel(root, { items, bursts })
  const links = buildAirLinks(root, { lines, items, tunnel, bursts, roomFor: () => out.room })
  // Everything past the fence hangs here: a phone doesn't draw it from the yard, a desktop shows it
  // through the trees as something to come.
  const scene = new Group()
  root.add(scene)
  buildPaint(scene)
  buildFence(scene)
  const planes = createPlanes(scene, { items, bursts, stats, trucks })

  // Bought or not, the same buildings stand here: black outlines until the airport is paid for.
  const H = AIR.hangar
  const A = AIR.tanks
  const real = new Group()
  real.visible = false
  scene.add(real)
  const shapes = [silhouette(scene, buildHangar(), H.x, H.z), silhouette(scene, buildTanks(), A.x, A.z)]
  place(real, buildHangar(), H.x, H.z)
  place(real, buildTanks(), A.x, A.z)
  place(real, buildClutter())
  solidBox(H.w / 2, H.h / 2, H.d / 2 + 0.5, H.x, H.h / 2, H.z)
  solidBox(8, 3, 6.5, A.x, 3, A.z)
  for (const [x, z] of AIR.masts) {
    place(scene, buildMast(), x, z)
    solidBox(0.6, 3, 0.6, x, 3, z)
  }

  // Everything lit, off until the airport is bought.
  const lights = new Group()
  lights.visible = false
  scene.add(lights)
  const edge = []
  for (let x = R.west; x <= R.east; x += R.edgeEvery) for (const z of [R.z - R.half - 0.7, R.z + R.half + 0.7]) edge.push([x, 0.34, z, 0.3, 0.3, 0.3])
  instanced(lights, neon('#ffe9a8', 2.4), edge)
  const ends = []
  for (let z = -R.half; z <= R.half; z += 2) {
    ends.push([R.west - 0.6, 0.3, R.z + z, 0.34, 0.26, 0.34])
    ends.push([R.east + 0.6, 0.3, R.z + z, 0.34, 0.26, 0.34])
  }
  instanced(lights, neon('#39ff8a', 3), ends)
  const flood = []
  for (const [x, z] of AIR.masts) flood.push([x, 18.2, z + (z < R.z ? 0.24 : -0.24), 3.1, 0.8, 0.06])
  instanced(lights, neon('#fff3d6', 3.6), flood)
  const rabbit = instanced(lights, neon('#ffffff', 5), [[0, 0, 0, 0.5, 0.4, 10]])
  rabbit.visible = false
  const rabbitFrom = R.east + 130
  const lead = []
  for (let x = R.east + 14; x < rabbitFrom; x += 14) lead.push([x, 0.6, R.z, 0.3, 0.3, 9 - ((x - R.east) / 130) * 3])
  instanced(lights, neon('#ffd27a', 2.2), lead)

  // The windsock: a pole, and five rings that stream and droop by themselves.
  const sock = new Group()
  sock.position.set(AIR.sock.x, 8.6, AIR.sock.z)
  const pole = new Group()
  bar(pole, matte('#d9dbe0'), 0.12, 8.6, 0, 4.3, 0, 'y', 8)
  place(scene, pole, AIR.sock.x, AIR.sock.z)
  const rings = []
  for (let i = 0; i < 5; i++) {
    const m = new Mesh(new BoxGeometry(0.62, 0.9 - i * 0.11, 0.9 - i * 0.11), matte(i % 2 ? '#f6f2e8' : '#ec6a1c'))
    m.castShadow = true
    sock.add(m)
    rings.push(m)
  }
  scene.add(sock)

  const marshal = buildMarshal()
  marshal.g.position.set(170, 0, AIR.stand.z)
  marshal.g.rotation.y = -Math.PI / 2
  real.add(marshal.g)

  // The bunker, and the boom out of it.
  place(real, buildBunker())
  solidBox(K.w / 2 + 0.3, 1.3, K.d / 2 + 0.3, K.x, 1.3, K.z)
  const beltTex = paintBelt()
  beltTex.wrapS = beltTex.wrapT = RepeatWrapping
  const boom = buildBoom(beltTex)
  boom.rotation.order = 'YXZ'
  real.add(boom)
  const boomFoot = new Group()
  box(boomFoot, matte(YARD.colors.navy), 1.8, 0.8, 1.4, 0, 0.4, 0)
  place(real, boomFoot, LD.foot[0], LD.foot[2])
  const boomWheels = new Group()
  for (const x of [-0.9, 0.9]) bar(boomWheels, matte('#15161c'), 0.42, 0.3, x, 0.42, 0, 'x', 12)
  box(boomWheels, matte(YARD.colors.navy), 0.2, 1, 0.2, 0, 0.9, 0)
  const boomLeg = place(real, boomWheels)

  const [fx, fy, fz] = LD.foot
  const [hx, hy, hz] = LD.head
  const span = Math.hypot(hx - fx, hy - fy, hz - fz)
  const dir = [(hx - fx) / span, (hy - fy) / span, (hz - fz) / span]
  boom.rotation.set(-Math.asin(dir[1]), Math.atan2(dir[0], dir[2]), 0)
  let reach = 0 // 0 drawn back .. 1 out at the ramp

  function setReach(k) {
    reach = k
    const end = span - LD.back * (1 - k)
    const mid = end - BOOM / 2
    boom.position.set(fx + dir[0] * mid, fy + dir[1] * mid, fz + dir[2] * mid)
    const leg = end - 1.4
    boomLeg.position.set(fx + dir[0] * leg, 0, fz + dir[2] * leg)
    boomLeg.rotation.y = boom.rotation.y
  }
  setReach(0)

  const pile = [] // everything waiting, last in on top
  const lift = [] // on the boom: { item, d }
  const up = [] // on the ramp: { item, d }
  let incoming = 0 // in the air on their way to the bunker
  let rising = 0 // in the air on their way to the boom
  let owned = false
  let tipLeft = 0
  let boostK = 1
  const foot = { x: fx, y: fy + 0.4, z: fz }
  const spot = { x: 0, y: 0, z: 0 }

  // Where item i of the bunker's top layers lies: `pile.length` raises the heap.
  function heapAt(i, to) {
    const fill = Math.min(1, pile.length / K.max)
    to.x = K.x + (Math.floor(i / SHOW_ROW) % 2 ? 1.4 : -1.4)
    to.z = K.z + ((i % SHOW_ROW) - (SHOW_ROW - 1) / 2) * 0.86
    to.y = 0.6 + fill * (K.wall - 0.2) + Math.floor(i / (SHOW_ROW * 2)) * 0.8
    return to
  }

  function restPile(item, from) {
    const to = heapAt(pile.length % K.show, { x: 0, y: 0, z: 0 })
    incoming++
    items.fly(item, from, to, 0.4, () => {
      incoming--
      pile.push(item)
    })
  }

  const out = {
    tunnel,
    planes,
    links,
    get open() {
      return owned
    },
    get belted() {
      return tunnel.owned
    },
    // How many more items the bunker will take, counting those on their way.
    get room() {
      return K.max - pile.length - incoming - tunnel.riding - links.riding
    },
    get pile() {
      return pile.length
    },
    // A log for the bunker, from hands beside it.
    tipPile(item, from) {
      if (out.room <= 0) return false
      restPile(item, from)
      return true
    },
    // A log onto the belt at the hopper.
    tipBelt(item) {
      return out.room > 0 && tunnel.take(item)
    },
    buildBelt() {
      tunnel.buildBelt()
      links.show()
    },
    setBoost(k) {
      boostK = k
      tunnel.setBoost(k)
    },
    // The walk from the forest to the bunker, as workers.js paths: [x, z, y]. `n` spreads them out.
    walk(n) {
      const z = T.lane + (n % 4) * 0.6 - 0.9
      return [[T.west - 1.2, z, 0], [T.portal, z, T.floor], [T.east, z, T.floor], [T.top, z, 0], [K.stand[0], K.stand[1], 0]]
    },
    home(n) {
      const z = T.lane + (n % 4) * 0.6 - 0.9
      return [[T.top, z, 0], [T.east, z, T.floor], [T.portal, z, T.floor], [T.west - 1.2, z, 0]]
    },
    // `quiet`: a save being put back, no ceremony.
    buy(quiet) {
      owned = true
      real.visible = lights.visible = true
      for (const s of shapes) s.visible = false
      if (quiet) planes.placeNow()
      else {
        sfx.powerUp(K.x, K.z)
        for (let i = 0; i < 60; i++) bursts.flames.spawn({ x: H.x + (Math.random() - 0.5) * 70, y: 1 + Math.random() * 6, z: 4 + (Math.random() - 0.5) * 40, vy: 2 + Math.random() * 5, life: 0.9 + Math.random(), size: 0.45, color: i % 2 ? '#ffd84a' : '#ffffff', gravity: 2 })
        planes.callIn()
      }
    },
    reset() {
      owned = false
      real.visible = lights.visible = false
      for (const s of shapes) s.visible = true
      tunnel.reset()
      links.reset()
      planes.reset()
      pile.length = lift.length = up.length = 0
      incoming = rising = 0
      boostK = 1
      setReach(0)
    },
    update(dt, elapsed, you) {
      links.update(dt)
      tunnel.update(dt, (item, from) => {
        if (pile.length + incoming >= K.max) return false
        restPile(item, from)
        return true
      })
      bursts.dust.update(dt)
      bursts.flames.update(dt)
      if (COARSE_POINTER) scene.visible = you.x > AIR.fieldFrom
      if (!owned) return
      planes.update(dt, elapsed, you, lighting.isNight())
      for (let i = 0; i < rings.length; i++) {
        const k = i / rings.length
        const sway = Math.sin(elapsed * 1.8 + k * 3) * (0.1 + k * 0.5)
        const gust = 0.72 + Math.sin(elapsed * 0.31) * 0.26
        rings[i].position.set(-0.3 - i * 0.6, -k * k * (1 - gust) * 2.8, sway)
      }

      // The approach lights run in, while one is coming down them.
      const coming = planes.state === 'approach'
      rabbit.visible = coming
      if (coming) {
        dummy.position.set(rabbitFrom - ((elapsed * 1.5) % 1) * 130, 0.7, R.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(0.5, 0.4, 10)
        dummy.updateMatrix()
        rabbit.setMatrixAt(0, dummy.matrix)
        rabbit.instanceMatrix.needsUpdate = true
      }

      // The man on the apron waves it in, and stands at ease when it's in.
      const m = planes.m
      if (m) {
        marshal.g.position.x = m.stopX + m.nose + 5
        const k = planes.taxiing ? Math.sin(elapsed * 5) * 0.5 - 2.6 : -0.15
        marshal.arms[0].rotation.x += (k - marshal.arms[0].rotation.x) * Math.min(1, dt * 10)
        marshal.arms[1].rotation.x += (k - marshal.arms[1].rotation.x) * Math.min(1, dt * 10)
      }

      // The boom runs out to a parked plane's ramp and back in before the next one turns in.
      const wanted = planes.parked ? 1 : 0
      if (reach !== wanted) setReach(reach < wanted ? Math.min(1, reach + dt * 1.2) : Math.max(0, reach - dt * 1.6))
      const ready = planes.accepting && reach === 1
      const ramp = planes.ramp

      // Out of the bunker, along the boom, up the ramp and in.
      tipLeft -= dt
      const inFlight = lift.length + up.length + rising
      const clearFoot = !lift.length || lift[lift.length - 1].d > LD.gap
      if (ready && pile.length && planes.room > inFlight && tipLeft <= 0 && clearFoot) {
        tipLeft = AIR.tip
        const item = pile.pop()
        rising++
        items.fly(item, heapAt(0, spot), foot, 0.22, () => {
          rising--
          lift.push({ item, d: 0 })
        })
      }
      if (ready && inFlight) beltTex.offset.y += (LD.speed * dt) / 1.2
      const slope = Math.asin(dir[1])
      for (let i = 0; i < lift.length; i++) {
        const b = lift[i]
        const limit = i ? lift[i - 1].d - LD.gap : Infinity
        if (ready || b.d < span - 1) b.d = Math.min(b.d + LD.speed * dt, limit, span)
        if (b.d >= span && !i && ready) {
          lift.shift()
          i--
          up.push({ item: b.item, d: 0 })
          continue
        }
        items.add(b.item, fx + dir[0] * b.d, fy + dir[1] * b.d + items.rest(b.item), fz + dir[2] * b.d, Math.atan2(dir[0], dir[2]), 0.9, -slope)
      }
      if (ramp) {
        const [lx, ly] = ramp.lip
        const [ax, ay] = ramp.hinge
        const len = Math.hypot(ax - lx, ay - ly)
        const pitch = Math.atan2(ay - ly, ax - lx)
        for (let i = 0; i < up.length; i++) {
          const b = up[i]
          b.d = Math.min(b.d + LD.speed * dt, len)
          if (b.d >= len && !i) {
            up.shift()
            i--
            planes.take(b.item)
            bursts.dust.spawn({ x: ax, y: ay + 0.4, z: AIR.stand.z, vy: 1, vx: -1, life: 0.6, size: 0.6, grow: 2.6, color: '#c9a878', opacity: 0.5 })
            sfx.holdThud(b.item.kind, ax, ay, AIR.stand.z)
            continue
          }
          const k = b.d / len
          items.add(b.item, lx + (ax - lx) * k, ly + (ay - ly) * k + items.rest(b.item), AIR.stand.z, Math.PI / 2, 0.9, -pitch)
        }
      }
      const shown = Math.min(pile.length, K.show)
      for (let i = 0; i < shown; i++) {
        heapAt(i, spot)
        items.add(pile[pile.length - 1 - i], spot.x, spot.y, spot.z, Math.PI / 2)
      }
    },
  }
  return out
}
