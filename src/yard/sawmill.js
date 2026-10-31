import { AdditiveBlending, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, Sprite, SpriteMaterial, Vector3 } from 'three'
import { GAME, YARD } from '../config.js'
import { label, neon, solidBox, solidPole } from '../propkit.js'
import { box, bar, matte, picture, place, silhouette, spring } from './kit.js'
import { pallet } from './boards.js'
import { paintSwitch } from './paint.js'

// The machines of the line. The Debarker: a gold housing with a dark tunnel, hazard chevrons,
// a navy top plate carrying the blue hopper and red lamp, and a railed conveyor through it,
// logs in at the north end and out over the south end. Local +Z = south. Each of the others
// stands as a black silhouette until it is bought; the conveyors between them are simply absent.
const { colors: C } = YARD

function guardRail() {
  const rail = matte(C.guardRail)
  rail.userData.silhouette = '#c9c9c9'
  return rail
}

function conveyor(g, sign, from = 2.2, len = 3.6) {
  const navy = matte(C.navy)
  const belt = matte('#4a5060')
  const rail = guardRail()
  const start = sign * from
  const z = start + (sign * len) / 2
  box(g, navy, 2.2, 0.42, len, 0, 1.32, z)
  box(g, belt, 1.7, 0.06, len + 0.1, 0, 1.56, z)
  // Legs: a tall pair at the far end, a stub at the housing.
  box(g, navy, 1.5, 1.1, 0.7, 0, 0.55, start + sign * (len - 0.5))
  // Yellow guard rails on little posts.
  for (const x of [-1.02, 1.02]) {
    box(g, rail, 0.14, 0.12, len, x, 2.02, z)
    for (let i = 0; i < 3; i++) box(g, rail, 0.12, 0.42, 0.12, x, 1.8, start + (sign * (i + 0.5) * len) / 3)
  }
}

// Everything but the moving parts.
function buildHousing() {
  const g = new Group()
  const gold = matte(C.gold)
  const shade = matte(C.goldDark)
  const navy = matte(C.navy)
  const black = matte('#101622')
  // Plinth.
  box(g, navy, 4, 0.5, 5.2, 0, 0.25, 0)
  box(g, navy, 4.5, 0.2, 4.4, 0, 0.1, 0)
  // Walls around the tunnel.
  const W = 3.5
  const H = 3.4
  const D = 4.2
  const mid = 0.5 + H / 2
  box(g, gold, 0.72, H, D, -W / 2 + 0.36, mid, 0)
  box(g, gold, 0.72, H, D, W / 2 - 0.36, mid, 0)
  box(g, gold, W, 1.1, D, 0, 0.5 + H - 0.55, 0)
  box(g, shade, W + 0.02, 0.12, D + 0.02, 0, 2.86, 0)
  box(g, shade, 0.76, 0.1, D + 0.02, -W / 2 + 0.36, 1.1, 0)
  box(g, shade, 0.76, 0.1, D + 0.02, W / 2 - 0.36, 1.1, 0)
  // Tunnel lining and a back-lit floor.
  box(g, black, W - 1.4, 2.4, D - 0.3, 0, 1.68, 0)
  box(g, matte('#242b3b'), W - 1.46, 0.08, D + 0.02, 0, 0.56, 0)
  // Hazard chevrons over both mouths.
  for (const face of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      box(g, black, 0.3, 0.72, 0.06, -1.05 + i * 0.7, 3.32, face * (D / 2 + 0.02), 0, 0, 0.42)
    }
  }
  // Top plate, hopper, lamp housing and the flue.
  box(g, navy, W + 0.5, 0.36, D + 0.6, 0, 0.5 + H + 0.18, 0)
  box(g, matte('#2f3a56'), W + 0.2, 0.08, D + 0.3, 0, 0.5 + H + 0.4, 0)
  const top = 0.5 + H + 0.44
  const blue = matte('#2452de', { roughness: 0.35 })
  box(g, blue, 2.1, 1.05, 1.9, 0.35, top + 0.52, 0.2)
  for (let i = 0; i < 4; i++) box(g, matte('#1c3cae'), 2.14, 0.1, 0.18, 0.35, top + 1.08, -0.45 + i * 0.44)
  box(g, black, 0.3, 1.5, 0.3, -1.3, top + 0.75, -1.2)
  box(g, matte('#6a0f16'), 0.6, 0.12, 0.6, -0.9, top + 0.06, 1.1)
  conveyor(g, -1)
  conveyor(g, 1)
  return g
}

// The round saw in the tunnel mouth, seen as a brown gear in the reference.
function buildBlade() {
  const blade = new Group()
  const teeth = 12
  const geo = new CylinderGeometry(0.72, 0.72, 0.1, teeth * 2)
  geo.rotateX(Math.PI / 2)
  const disc = new Mesh(geo, matte('#8d6333'))
  blade.add(disc)
  const hub = new Mesh(new CylinderGeometry(0.2, 0.2, 0.16, 10).rotateX(Math.PI / 2), matte('#3a2c1e'))
  blade.add(hub)
  const steelTooth = matte('#a8794a')
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    box(blade, steelTooth, 0.2, 0.2, 0.09, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0, 0, 0, a)
  }
  return blade
}

// The Sawmill: an open gantry over the belt, its blade cutting along it, a blue bin beside.
function buildSawGantry() {
  const g = new Group()
  const gold = matte(C.gold)
  const shade = matte(C.goldDark)
  const navy = matte(C.navy)
  box(g, navy, 3.4, 0.5, 5.2, 0, 0.25, 0)
  box(g, navy, 2.2, 0.42, 4.6, 0, 1.32, 0)
  box(g, matte('#4a5060'), 1.7, 0.06, 4.7, 0, 1.56, 0)
  conveyor(g, -1)
  conveyor(g, 1)
  for (const x of [-1.75, 1.75]) {
    box(g, gold, 0.5, 6, 0.8, x, 3, 0)
    box(g, shade, 0.54, 0.1, 0.84, x, 2.2, 0)
  }
  box(g, gold, 4, 0.7, 1, 0, 6.2, 0)
  box(g, matte('#101622'), 1, 1.3, 1, 0, 5.3, 0)
  // Sawdust bin.
  box(g, matte('#2452de', { roughness: 0.35 }), 1.5, 1.6, 2, 2.9, 0.85, 1.2)
  for (let i = 0; i < 3; i++) box(g, matte('#1c3cae'), 1.54, 0.1, 0.16, 2.9, 1.6, 0.6 + i * 0.6)
  return g
}

// The Kiln: a red brick drying oven with a stepped dark roof, a brick stack and a barred
// fire door, with short belts either end.
function buildKiln() {
  const g = new Group()
  const brick = matte('#b4402e')
  const course = matte('#8f2f22')
  const roof = matte(C.navy)
  box(g, roof, 5.4, 0.5, 8, 0, 0.25, 0)
  box(g, brick, 5, 4, 6.8, 0, 2.5, 0)
  for (let y = 1.1; y < 4.4; y += 0.8) box(g, course, 5.04, 0.1, 6.84, 0, y, 0)
  box(g, matte('#101622'), 2.2, 2.3, 6.9, 0, 1.75, 0) // the mouths the belt runs through
  box(g, roof, 5.6, 0.4, 7.4, 0, 4.7, 0)
  box(g, roof, 3.8, 1.4, 5, 0, 5.6, 0)
  box(g, roof, 4.3, 0.3, 5.6, 0, 6.4, 0)
  bar(g, brick, 0.72, 2.8, 0, 7.6, -0.6, 'y', 12)
  bar(g, course, 0.95, 0.5, 0, 9.1, -0.6, 'y', 12)
  for (const x of [-2.53, 2.53]) {
    box(g, matte('#1a1c24'), 0.06, 1.7, 2.2, x, 2.2, 0)
    for (let i = 0; i < 5; i++) box(g, matte('#e0a530'), 0.08, 1.5, 0.16, x, 2.2, -0.8 + i * 0.4)
  }
  conveyor(g, -1, 3.4, 2.6)
  conveyor(g, 1, 3.4, 2.6)
  return g
}

// The Bundler: an open gantry straddling a blue bed, strapping boards into bundles.
function buildBundler() {
  const g = new Group()
  const frame = matte(C.gold)
  const head = matte(C.navy)
  for (const z of [-1.4, 1.4]) {
    for (const x of [-1.7, 1.7]) box(g, frame, 0.34, 5.6, 0.34, x, 2.8, z)
    box(g, frame, 3.8, 0.34, 0.34, 0, 5.5, z)
  }
  for (const x of [-1.7, 1.7]) box(g, frame, 0.3, 0.3, 3.2, x, 5.5, 0)
  box(g, head, 2.4, 0.7, 2.4, 0, 4.9, 0)
  conveyor(g, -1, 0.2, 3.4)
  conveyor(g, 1, 0.2, 2.3)
  box(g, head, 2.2, 0.42, 3.2, 0, 1.32, 0)
  box(g, matte('#2452de', { roughness: 0.35 }), 3.4, 0.5, 3.4, 0, 0.3, 0)
  return g
}

// A bought length of belt between two machines, `len` long, running from local z = 0.
function buildLink(len) {
  const g = new Group()
  conveyor(g, 1, 0, len)
  box(g, matte(C.navy), 1.5, 1.1, 0.7, 0, 0.55, 0.5)
  return g
}

// The quarter turn at the Bundler's end, where the belt heads west for the Workshop.
function buildCorner() {
  const g = new Group()
  const rail = guardRail()
  box(g, matte(C.navy), 2.2, 0.42, 2.2, 0, 1.32, 0)
  box(g, matte('#4a5060'), 1.7, 0.06, 2.2, 0, 1.56, 0)
  box(g, matte(C.navy), 1.5, 1.1, 0.7, 0, 0.55, 0)
  box(g, rail, 0.14, 0.12, 2.2, 1.02, 2.02, 0)
  box(g, rail, 2.2, 0.12, 0.14, 0, 2.02, 1.02)
  return g
}

// What locks the Rebirth 1 slot: a wide low press with long belts, laid east-west.
function buildPress() {
  const g = new Group()
  const body = matte(C.navy)
  box(g, body, 3.6, 0.5, 5.4, 0, 0.25, 0)
  box(g, body, 3.4, 2.9, 4.8, 0, 1.9, 0)
  box(g, body, 3.9, 0.3, 5.2, 0, 3.5, 0)
  conveyor(g, -1, 2.5, 2.6)
  conveyor(g, 1, 2.5, 2.6)
  return g
}

// The Workshop's three buildings, all on the same slot and belts; local +Z runs with the belt.
function slotBase(g, floor) {
  box(g, matte(floor), 4.2, 0.5, 5.4, 0, 0.25, 0)
  conveyor(g, -1, 2.5, 2.6)
  conveyor(g, 1, 2.5, 2.6)
}

// Plank walls under a red roof, a hammer on the side. Makes chairs.
function buildWorkshop() {
  const g = new Group()
  const wood = matte('#c9a374')
  const seam = matte('#a8845a')
  const roof = matte('#b02a2a')
  slotBase(g, C.navy)
  box(g, wood, 4, 4, 4.6, 0, 2.5, 0)
  for (let y = 1.2; y < 4.4; y += 0.8) box(g, seam, 4.04, 0.08, 4.64, 0, y, 0)
  for (const x of [-1.15, 1.15]) box(g, roof, 2.7, 0.3, 5.2, x, 5.1 - Math.abs(x) * 0.5 + 0.55, 0, 0, 0, x > 0 ? -0.5 : 0.5)
  box(g, roof, 0.4, 0.3, 5.2, 0, 5.92, 0)
  box(g, matte('#101622'), 2, 2.5, 4.7, 0, 1.75, 0)
  for (const x of [-2.04, 2.04]) {
    box(g, matte('#efe6d4'), 0.04, 1.5, 1.7, x, 2.7, 0)
    box(g, matte('#3b3026'), 0.06, 0.26, 1.1, x, 3.1, 0)
    box(g, matte('#3b3026'), 0.06, 1, 0.22, x, 2.7, 0.1)
  }
  return g
}

// Blue panels on hazard feet, a robot arm on the roof. Makes tables.
function buildTablesShop() {
  const g = new Group()
  const blue = matte('#2f5fbe')
  const dark = matte('#1f3f86')
  slotBase(g, C.navy)
  box(g, blue, 4, 4.4, 4.8, 0, 2.7, 0)
  box(g, matte('#101622'), 2.2, 2.3, 4.9, 0, 1.75, 0)
  for (const x of [-2.03, 2.03]) {
    box(g, dark, 0.04, 4.3, 0.1, x, 2.7, -1.2)
    box(g, dark, 0.04, 4.3, 0.1, x, 2.7, 1.2)
    box(g, matte('#3f8ae8'), 0.05, 0.6, 1, x, 4.2, -1.2)
    box(g, matte('#3f8ae8'), 0.05, 0.6, 1, x, 4.2, 1.2)
    box(g, matte(C.gold), 0.06, 1.2, 1.8, x, 2.3, 0)
    box(g, matte('#2a2d38'), 0.08, 0.8, 1.3, x, 2.3, 0)
    box(g, matte(C.gold), 0.1, 0.1, 0.9, x, 2.5, 0)
    for (const z of [-0.36, 0.36]) box(g, matte(C.gold), 0.1, 0.4, 0.1, x, 2.25, z)
    box(g, matte('#121622'), 0.06, 0.5, 4.8, x, 0.72, 0)
  }
  for (let i = 0; i < 8; i++) box(g, matte(C.gold), 0.07, 0.42, 0.22, 2.05, 0.72, -2.1 + i * 0.6, 0, 0.4)
  box(g, matte('#6d7f9a'), 4.1, 0.2, 4.9, 0, 5, 0)
  box(g, matte('#2a2d38'), 0.8, 0.5, 0.8, 0.6, 5.3, -1)
  box(g, matte('#d9772b'), 0.34, 1.4, 0.34, 0.6, 6.1, -1, 0, 0.3)
  box(g, matte('#d9772b'), 0.3, 0.3, 1.2, 0.6, 6.7, -0.4)
  box(g, matte('#c49a66'), 0.8, 0.1, 1, 0.6, 6.42, 0.3)
  for (const x of [0.28, 0.92]) for (const z of [-0.1, 0.7]) box(g, matte('#9a7144'), 0.08, 0.3, 0.08, x, 6.25, z)
  for (const x of [-1.1, -0.2]) bar(g, matte('#8fa0ba'), 0.26, 0.6, x, 5.4, 1, 'y', 10)
  const lamp = neon('#39e16e', 2)
  box(g, lamp, 0.3, 0.3, 0.3, 1.8, 5.2, 1.9).castShadow = false
  return g
}

// Purple glass in gold corners and cyan neon, a dome on top. Makes beds.
function buildBedsShop() {
  const g = new Group()
  const gold = matte(C.gold)
  const glow = neon('#25e3ff', 2.4)
  slotBase(g, '#2c2a6a')
  box(g, matte('#5a2fd0', { roughness: 0.3 }), 4, 4.3, 4.8, 0, 2.65, 0)
  box(g, matte(C.navy), 4.2, 0.3, 5, 0, 4.95, 0)
  box(g, matte('#0d2230'), 2.2, 2.3, 4.9, 0, 1.75, 0)
  for (const z of [-2.44, 2.44]) {
    for (const x of [-1.24, 1.24]) box(g, gold, 0.3, 2.6, 0.1, x, 1.8, z)
    box(g, gold, 2.8, 0.3, 0.1, 0, 3.05, z)
    box(g, glow, 2.2, 0.08, 0.12, 0, 2.86, z).castShadow = false
    for (const x of [-1.06, 1.06]) box(g, glow, 0.08, 2.2, 0.12, x, 1.75, z).castShadow = false
  }
  for (const x of [-2.04, 2.04]) {
    for (const z of [-2.42, 2.42]) box(g, gold, 0.2, 4.4, 0.2, x, 2.7, z)
    box(g, glow, 0.05, 3.8, 0.1, x, 2.7, -1.6).castShadow = false
    box(g, glow, 0.05, 3.8, 0.1, x, 2.7, 1.6).castShadow = false
    box(g, matte('#101622'), 0.06, 1.5, 1.8, x, 2.6, 0)
    box(g, matte('#d62f35'), 0.08, 0.5, 1.1, x, 2.5, 0)
    box(g, matte('#f3f1ea'), 0.08, 0.2, 0.4, x, 2.9, -0.4)
  }
  box(g, glow, 4.3, 0.12, 5.1, 0, 0.56, 0).castShadow = false
  bar(g, matte('#3f8ae8', { roughness: 0.25 }), 0.8, 0.5, 0, 5.3, 1, 'y', 12)
  bar(g, matte('#6fb6ff', { roughness: 0.25 }), 0.5, 0.3, 0, 5.65, 1, 'y', 12)
  for (const x of [-0.9, 0.9]) box(g, gold, 0.2, 1, 0.2, x, 5.5, -1.2)
  box(g, matte('#6b4023'), 2.1, 0.2, 1.3, 0, 5.95, -1.2)
  box(g, matte('#d62f35'), 1.4, 0.16, 1.2, -0.3, 6.12, -1.2)
  box(g, matte('#f3f1ea'), 0.6, 0.16, 1.2, 0.72, 6.12, -1.2)
  box(g, matte('#5e3820'), 0.14, 0.7, 1.3, 1.05, 6.3, -1.2)
  return g
}

// The Truck Conveyer's belt, ramps and stilts. Every run is a straight piece between two
// [x, y, z] points on the belt surface; local +Z runs along it.
function beltRun(g, [ax, ay, az], [bx, by, bz]) {
  const len = Math.hypot(bx - ax, by - ay, bz - az)
  const run = new Group()
  run.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
  run.rotation.order = 'YXZ'
  run.rotation.y = Math.atan2(bx - ax, bz - az)
  run.rotation.x = -Math.atan2(by - ay, Math.hypot(bx - ax, bz - az))
  const rail = guardRail()
  box(run, matte(C.navy), 2.2, 0.3, len + 0.2, 0, -0.2, 0)
  box(run, matte('#4a5060'), 1.7, 0.06, len + 0.2, 0, -0.03, 0)
  for (const x of [-1.02, 1.02]) box(run, rail, 0.14, 0.12, len + 0.2, x, 0.3, 0)
  g.add(run)
}

function buildTruckBelt(path, legEvery) {
  const g = new Group()
  for (let i = 0; i < path.length - 1; i++) beltRun(g, path[i], path[i + 1])
  const legs = []
  const [start, end] = path.slice(-2)
  for (let z = start[2]; z >= end[2]; z -= legEvery) {
    legs.push([start[0], z])
    box(g, matte(C.navy), 0.4, start[1] - 0.4, 0.4, start[0], (start[1] - 0.4) / 2, z) // stops under the belt
  }
  return { model: g, legs }
}

// The branch to the Train Loader: flat, on stilts, with a chute over the rail at the far end.
function buildTrainBelt(path, legEvery) {
  const g = new Group()
  const [start, end] = path
  beltRun(g, start, end)
  const legs = []
  for (let x = start[0] - 3; x > end[0] + 1; x -= legEvery) {
    legs.push([x, start[2]])
    box(g, matte(C.navy), 0.4, start[1] - 0.4, 0.4, x, (start[1] - 0.4) / 2, start[2])
  }
  const yellow = matte('#f2c21c')
  box(g, yellow, 2.4, 0.2, 2.2, end[0] - 1, end[1] - 0.5, end[2], 0, 0, 0.5)
  for (const z of [-1.1, 1.1]) box(g, yellow, 2.4, 0.8, 0.14, end[0] - 1, end[1] - 0.2, end[2] + z, 0, 0, 0.5)
  return { model: g, legs }
}

// An upper floor's way down to the Truck Conveyer: a yellow shaft from its belt to the ground,
// `up` metres tall, drawn from the floor it serves.
function buildTruckLift(up) {
  const g = new Group()
  const yellow = matte('#f2c21c')
  const [x, , z] = GAME.line.truckLift[1]
  const top = 2.6
  beltRun(g, [GAME.line.truckLift[0][0], GAME.line.beltY, z], [x, GAME.line.beltY, z])
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) box(g, yellow, 0.2, up + top, 0.2, x + dx, (top - up) / 2, z + dz)
  }
  box(g, yellow, 2.4, 0.2, 2.4, x, top, z)
  for (let y = 3; y < up; y += 3) {
    for (const dz of [-1, 1]) box(g, matte(C.navy), 2, 0.1, 0.1, x, y - up, z + dz)
  }
  return g
}

const MODELS = { sawmill: buildSawGantry, kiln: buildKiln, bundler: buildBundler }
const SHOPS = { workshop: buildWorkshop, tables: buildTablesShop, beds: buildBedsShop }

// The floating signs over a machine: WORKERS ON / OFF and, once it has a conveyor to feed,
// OUTPUT NEXT / PALLET. They always face the camera and stand side by side as it sees them.
function machineSign(scene, stage, title, kind, text, state) {
  const tag = label(title, 0.62, { color: '#d9f53c', outline: '#254a10', outlineWidth: 12 })
  const tex = paintSwitch(text, state)
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  sprite.scale.set(3.9, 1, 1)
  scene.add(tag, sprite)
  return { stage, kind, tag, sprite, tex, hover: false, press: 0, k: 1, v: 0 }
}

// The Debarker Turbo, as the reference shows it: a hazard-striped yellow gantry with debarking
// drums over the belt and a control box with a 2X screen, then a tall yellow body with a blue
// hopper, a pink knob and a flue, lit by cyan strips. Same belt through it as the plain Debarker
// (logs in at the north end, out at the south). The drums and lamp are added by the caller.
function buildTurbo() {
  const g = new Group()
  const yellow = matte('#f2c21c')
  const dim = matte('#c99a12')
  const navy = matte(C.navy)
  const black = matte('#12151f')
  const blue = matte('#2452de', { roughness: 0.35 })
  const cyan = neon('#25e3ff', 2.4)
  const bz = 1.25 // centre of the body, south of the gantry

  // Plinth, with the belt running through and out at both ends.
  box(g, navy, 4.6, 0.5, 5.2, 0, 0.25, 0)
  const belts = new Group()
  box(belts, navy, 2.2, 0.42, 4.6, 0, 1.32, 0)
  box(belts, matte('#4a5060'), 1.7, 0.06, 4.7, 0, 1.56, 0)
  conveyor(belts, -1)
  conveyor(belts, 1)
  g.add(belts)

  // Body: a wall either side of the belt and a lintel over it, a dark liner inside.
  for (const x of [-1.4, 1.4]) box(g, yellow, 0.6, 3.6, 1.9, x, 2.3, bz)
  box(g, yellow, 3.4, 1.2, 1.9, 0, 3.5, bz)
  box(g, dim, 3.44, 0.1, 1.94, 0, 2.95, bz)
  for (const x of [-1.08, 1.08]) box(g, black, 0.04, 2.4, 1.9, x, 1.7, bz)
  box(g, navy, 3.7, 0.3, 2.1, 0, 4.25, bz)
  // A recessed dark panel in a yellow frame on each outer wall.
  for (const x of [-1.72, 1.72]) {
    box(g, dim, 0.06, 1.5, 1.5, x, 2.3, bz)
    box(g, black, 0.1, 1.1, 1.1, x, 2.3, bz)
    box(g, dim, 0.12, 0.1, 0.5, x, 2.3, bz + 0.3)
  }
  // Cyan strips up the four corners.
  for (const x of [-1.74, 1.74]) for (const z of [bz - 0.96, bz + 0.96]) box(g, cyan, 0.08, 3.5, 0.08, x, 2.3, z)
  // Hopper with slats, the pink knob and the flue.
  box(g, blue, 1.7, 0.8, 1.3, 0.35, 4.8, bz - 0.1)
  for (let i = 0; i < 4; i++) box(g, matte('#1c3cae'), 1.74, 0.08, 0.16, 0.35, 5.22, bz - 0.6 + i * 0.34)
  box(g, neon('#ff4fd8', 2.6), 0.28, 0.28, 0.28, 1.05, 5.35, bz + 0.3)
  box(g, black, 0.3, 2.4, 0.3, -1.35, 5.4, bz - 0.4)
  box(g, dim, 0.4, 0.12, 0.4, -1.35, 6.62, bz - 0.4)

  // The gantry over the input end: four posts, two crossbars, hazard stripes on the front one.
  for (const x of [-1.35, 1.35]) for (const z of [-1.9, -0.55]) box(g, yellow, 0.3, 3.5, 0.3, x, 2.25, z)
  for (const z of [-1.9, -0.55]) box(g, yellow, 3.0, 0.4, 0.34, 0, 3.8, z)
  for (const x of [-1.35, 1.35]) box(g, yellow, 0.3, 0.4, 1.65, x, 3.8, -1.225)
  for (let i = 0; i < 8; i++) box(g, black, 0.22, 0.46, 0.04, -1.2 + i * 0.34, 3.8, -2.09, 0, 0, 0.5)
  box(g, yellow, 3.0, 0.2, 0.2, 0, 2.7, -1.9)
  box(g, cyan, 2.6, 0.06, 0.06, 0, 3.55, -1.9)

  // The control box beside it: black with a hazard band and a dark screen for the 2X.
  box(g, black, 0.9, 1.4, 1.1, -1.95, 1.2, -1.2)
  box(g, yellow, 0.94, 0.5, 1.14, -1.95, 0.75, -1.2)
  for (let i = 0; i < 4; i++) box(g, black, 0.04, 0.56, 0.14, -2.42, 0.75, -1.65 + i * 0.3, 0, 0.5)
  box(g, matte('#08140d'), 0.04, 0.55, 0.95, -2.42, 1.55, -1.2)
  box(g, yellow, 1, 0.1, 1.2, -1.95, 1.95, -1.2)
  return g
}

// A debarking drum across the belt: a dark roller studded with yellow teeth, turned by the caller.
function buildDrum(z) {
  const pivot = new Group()
  pivot.position.set(0, 2.8, z)
  bar(pivot, matte('#2a2d38'), 0.3, 2.3, 0, 0, 0, 'x', 14)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    for (const x of [-0.8, 0, 0.8]) box(pivot, matte('#f2c21c'), 0.5, 0.14, 0.14, x, Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0, a)
  }
  return pivot
}

export function buildSawmills(world, stages, items, base = 0, view = null) {
  const { pad, machines: M } = YARD
  const { line: L } = GAME
  // A floor's machines stand in a group at its height, hidden until the floor is bought.
  const scene = base ? new Group() : world
  if (base) {
    scene.position.y = base
    scene.visible = false
    world.add(scene)
  }
  const fixed = []
  const solid = (hx, hy, hz, x, y, z) => {
    const c = solidBox(hx, hy, hz, x, y + base, z)
    if (base) c.setEnabled(false)
    fixed.push(c)
    return c
  }
  let ceiling = Infinity // the floor above keeps the floating signs under it

  // Pads: pale steel sheets with a darker blue lip.
  const pads = new Group()
  for (const p of YARD.pads) {
    const long = p.l ?? pad.l
    const w = p.wide ? long : pad.w
    const l = p.wide ? pad.w : long
    box(pads, matte(pad.edge), w + 0.14, 0.05, l + 0.14, p.x, 0.025, p.z)
    box(pads, matte(pad.color), w, 0.06, l, p.x, 0.03, p.z)
  }
  place(scene, pads)

  // The Debarker, bought first: its real model waits hidden behind the silhouette.
  const mill = new Group()
  place(mill, buildHousing())
  const blades = [buildBlade(), buildBlade()]
  blades[0].position.set(0, 1.55, 2.14)
  blades[1].position.set(0, 1.55, -2.14)
  for (const b of blades) b.scale.setScalar(0.72)
  mill.add(...blades)
  const lamp = neon('#ff2a2a', 3)
  const lampMesh = box(mill, lamp, 0.42, 0.2, 0.42, -0.9, 4.47, 1.1)
  lampMesh.castShadow = false
  mill.position.set(L.x, 0.06, M.debarker.z)
  mill.visible = false
  scene.add(mill)
  solid(2.1, 2, 5.6, L.x, 2, M.debarker.z)

  // Debarker Turbo: bought later, it takes the housing's place on the same belt. Its drums, lamp
  // and 2X screens move, so they sit outside the baked model.
  const turboRoot = new Group()
  place(turboRoot, buildTurbo())
  const drums = [buildDrum(-1.9), buildDrum(-0.55)]
  turboRoot.add(...drums)
  const turboLamp = neon('#ff3d8a', 3)
  box(turboRoot, turboLamp, 0.3, 0.22, 0.3, -1.95, 2.1, -1.2).castShadow = false
  const screen = paintSwitch(() => '2X', () => true)
  const screens = [picture(turboRoot, screen, 0.8, 0.2, -2.45, 1.55, -1.2, -Math.PI / 2), picture(turboRoot, screen, 0.8, 0.2, -1.95, 1.55, -1.77, Math.PI)]
  turboRoot.position.set(L.x, 0.06, M.debarker.z)
  turboRoot.visible = false
  scene.add(turboRoot)
  const turboBlock = solidBox(2.45, 2, 2.4, L.x, 2 + base, M.debarker.z)
  turboBlock.setEnabled(false)

  // The purchase pop: two shock rings on the floor and a light column, all fading out.
  const glowMat = (color) => new MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, toneMapped: false, fog: false })
  const rings = ['#25e3ff', '#ffd84a'].map((color) => {
    const ring = new Mesh(new RingGeometry(0.92, 1, 56).rotateX(-Math.PI / 2), glowMat(color))
    ring.position.set(L.x, 0.16, M.debarker.z)
    ring.visible = false
    scene.add(ring)
    return ring
  })
  const column = new Mesh(new CylinderGeometry(1.7, 1.7, 7, 24, 1, true), glowMat('#25e3ff'))
  column.position.set(L.x, 3.6, M.debarker.z)
  column.visible = false
  scene.add(column)
  let pop = -1 // s since the purchase, -1 = none

  // Every machine waits as a silhouette; buying one swaps its real model in.
  const locked = {}
  const real = { debarker: mill }
  locked.debarker = silhouette(scene, buildHousing(), L.x, M.debarker.z)
  for (const id of Object.keys(MODELS)) {
    const { x, z } = M[id]
    locked[id] = silhouette(scene, MODELS[id](), x, z)
    real[id] = place(scene, MODELS[id](), x, z, 0, 0.06)
    real[id].visible = false
  }
  solid(2.2, 2, 5.8, M.sawmill.x, 2, M.sawmill.z)
  solid(2.8, 2.4, 5.6, M.kiln.x, 2.4, M.kiln.z)
  solid(2.1, 2.2, 3.8, M.bundler.x, 2.2, M.bundler.z)
  solid(5.2, 2, 1.9, M.workshop.x, 2, M.workshop.z)

  // The Rebirth 1 slot: a silhouette, then the Workshop, which Tables and Beds replace.
  // Its belts run west, so the models turn a quarter.
  const WEST = -Math.PI / 2
  locked.workshop = silhouette(scene, buildPress(), M.workshop.x, M.workshop.z, WEST)
  for (const shape of Object.values(locked)) shape.position.y = 0.06 // level with the real models
  const shops = {}
  for (const [id, build] of Object.entries(SHOPS)) {
    shops[id] = place(scene, build(), M.workshop.x, M.workshop.z, WEST, 0.06)
    shops[id].visible = false
  }

  // The Sawmill's blade, spinning in the plane of the belt.
  const saw = buildBlade()
  saw.scale.setScalar(1)
  const sawPivot = new Group()
  sawPivot.position.set(M.sawmill.x, 2.1, M.sawmill.z)
  sawPivot.rotation.y = Math.PI / 2
  sawPivot.add(saw)
  sawPivot.visible = false
  scene.add(sawPivot)

  // Conveyors between the machines: nothing stands there until one is bought, and it is low
  // enough to jump over.
  const links = L.links.map((k) => {
    if (k.corner) {
      const { x, z } = k.corner
      const startX = x - 1.1
      const len = startX - k.toX
      const belt = new Group()
      place(belt, buildCorner(), 0, 0, 0, 0.06)
      place(belt, buildLink(len), startX - x, 0, WEST, 0.06)
      belt.position.set(x, 0, z)
      belt.visible = false
      scene.add(belt)
      const collider = solidBox(len / 2, 0.55, 1.15, (startX + k.toX) / 2, 0.55 + base, z)
      collider.setEnabled(false)
      return { belt, collider }
    }
    const len = k.to - k.from
    const belt = place(scene, buildLink(len), L.x, k.from, 0, 0.06)
    belt.visible = false
    const collider = solidBox(1.15, 0.55, len / 2, L.x, 0.55 + base, (k.from + k.to) / 2)
    collider.setEnabled(false)
    return { belt, collider }
  })

  // The Truck Conveyer, up on stilts past the bays; an upper floor reaches it by its Truck
  // Lifter. Off it, on the ground floor's plan, the branch to the Train Loader.
  const skyBelt = base ? { model: buildTruckLift(base), legs: [] } : buildTruckBelt(L.sky.path, L.sky.legEvery)
  const sky = place(scene, skyBelt.model)
  sky.visible = false
  const skyLegs = skyBelt.legs.map(([x, z]) => {
    const leg = solidPole(0.25, L.sky.path.at(-1)[1], x, z)
    leg.setEnabled(false)
    return leg
  })

  const trainRun = base ? null : buildTrainBelt(L.trainBelt, L.sky.legEvery)
  const trainBelt = trainRun && place(scene, trainRun.model)
  if (trainBelt) {
    trainBelt.visible = false
    locked.trainLoader = silhouette(scene, buildTrainBelt(L.trainBelt, L.sky.legEvery).model) // same stilts, so they stay solid
  }
  for (const [x, z] of trainRun?.legs ?? []) solidPole(0.25, L.trainBelt[0][1], x, z)

  // Pallets, where a machine's output lands when it has nowhere further to go.
  const pallets = stages.map((s) => {
    const dock = new Group()
    pallet(dock)
    const model = place(scene, dock, s.pallet.x, s.pallet.z, 0, 0, 0.8)
    model.visible = false
    return model
  })

  // A few scraps on the pad.
  const scraps = new Group()
  const scrap = matte('#5a3a26')
  for (const [x, z, yaw] of [[-2, 1.4, 0.4], [-1.9, 1.75, -0.5], [-2.25, 1.65, 1.2]]) box(scraps, scrap, 0.75, 0.1, 0.22, x, 0.11, z, yaw)
  place(scene, scraps, L.x, M.debarker.z)

  const signs = stages.flatMap((s) => {
    const list = [machineSign(scene, s, 'WORKERS', 'workers', () => (s.workers ? 'ON' : 'OFF'), () => s.workers)]
    const last = s.index === stages.length - 1 // past it, NEXT is the Truck Conveyer
    list.push(machineSign(scene, s, 'OUTPUT', 'output', () => (!s.next ? 'PALLET' : last ? 'TRUCK' : 'NEXT'), () => (s.next && last ? 'blue' : s.next)))
    return list
  })
  const shown = (sign) => sign.stage.owned && (sign.kind === 'workers' || sign.stage.linked)
  const right = new Vector3()

  return {
    // Which sign the ray is on, if the player is near enough to reach it.
    pickToggle(raycaster, from) {
      for (const sign of signs) {
        if (!sign.sprite.visible) continue
        if (Math.abs(from.y - base) > 5 || Math.hypot(sign.stage.x - from.x, sign.stage.z - from.z) > YARD.signRange) continue
        if (raycaster.intersectObject(sign.sprite).length) return sign
      }
      return null
    },
    hoverToggle(on) {
      for (const sign of signs) sign.hover = sign === on
    },
    repaintSigns() {
      for (const sign of signs) sign.tex.userData.paint()
    },
    pressToggle(sign) {
      const s = sign.stage
      if (sign.kind === 'workers') s.workers = !s.workers
      else s.next = !s.next
      sign.tex.userData.paint()
      sign.press = YARD.buttons.pressTime
      return sign.kind === 'workers' ? s.workers : s.next
    },
    own(id) {
      locked[id].visible = false
      if (id === 'workshop') shops.workshop.visible = true
      else real[id].visible = true
      if (id === 'sawmill') sawPivot.visible = true
      pallets[stages.findIndex((s) => s.id === id)].visible = true
    },
    link(i) {
      links[i].belt.visible = true
      links[i].collider.setEnabled(true)
    },
    // The Turbo takes the plain Debarker's place; buying it plays the pop.
    showTurbo(on) {
      turboRoot.visible = on
      turboBlock.setEnabled(on)
      if (!on) return
      mill.visible = false
      pop = 0
      for (const z of [-1.6, 0, 1.6]) items.burst(L.x, base + 1.8, M.debarker.z + z, 26)
    },
    // Tables or Beds take the Workshop's place.
    showShop(id) {
      for (const [name, model] of Object.entries(shops)) model.visible = name === id
    },
    showTruckBelt(on) {
      sky.visible = on
      for (const leg of skyLegs) leg.setEnabled(on)
    },
    showTrainBelt(on) {
      trainBelt.visible = on
      locked.trainLoader.visible = !on
    },
    // An upper floor's machines appear, as silhouettes, with its deck.
    open(on) {
      scene.visible = on
      for (const c of fixed) c.setEnabled(on)
    },
    setCeiling(y) {
      ceiling = y
    },
    // Back to one Debarker and a row of silhouettes.
    reset() {
      for (const id of Object.keys(locked)) locked[id].visible = true
      for (const model of [...Object.values(real), ...Object.values(shops)]) model.visible = false
      for (const k of links) {
        k.belt.visible = false
        k.collider.setEnabled(false)
      }
      sawPivot.visible = false
      this.showTurbo(false)
      this.showTruckBelt(false)
      if (trainBelt) this.showTrainBelt(false)
      ceiling = Infinity
      pallets.forEach((model) => (model.visible = false))
      for (const sign of signs) sign.tex.userData.paint()
    },
    update(dt, elapsed, camera) {
      right.setFromMatrixColumn(camera.matrixWorld, 0)
      if (view?.turned) right.negate()
      for (const sign of signs) {
        const on = shown(sign)
        sign.sprite.visible = sign.tag.visible = on
        if (!on) continue
        const s = sign.stage
        const side = s.linked ? (sign.kind === 'workers' ? -2.1 : 2.1) : 0
        const y = Math.min(s.sign, ceiling)
        sign.sprite.position.set(s.x + right.x * side, y, s.z + right.z * side)
        sign.tag.position.set(s.x + right.x * side, y + 0.72, s.z + right.z * side)
        sign.press = Math.max(0, sign.press - dt)
        spring(sign, sign.press > 0 ? YARD.buttons.pressed : sign.hover ? YARD.buttons.hover : 1, dt)
        sign.sprite.scale.set(3.9 * sign.k, sign.k, 1)
        sign.sprite.material.color.setScalar(sign.hover ? 1 + YARD.buttons.brighten : 1)
      }
      const running = stages[0].busy
      const spin = running ? 14 : 1.2
      blades[0].rotation.z -= dt * spin
      blades[1].rotation.z += dt * spin
      if (turboRoot.visible) {
        // Drums turn against each other, the whole machine shudders while it works, the lamp
        // and the 2X screens pulse.
        drums.forEach((d, i) => (d.rotation.x += dt * (running ? 20 : 2.4) * (i ? -1 : 1)))
        turboRoot.position.x = L.x + (running ? Math.sin(elapsed * 55) * 0.012 : 0)
        turboLamp.color.copy(turboLamp.userData.base).multiplyScalar(running ? 1.4 + Math.sin(elapsed * 9) * 0.9 : 0.5)
        const pulse = running ? 1.15 + Math.sin(elapsed * 8) * 0.25 : 1
        for (const s of screens) s.material.color.setScalar(pulse)
      }
      if (pop >= 0) {
        pop += dt
        rings.forEach((ring, i) => {
          const k = (pop - i * 0.22) / 1
          ring.visible = k > 0 && k < 1
          if (!ring.visible) return
          ring.scale.setScalar(1 + k * 8)
          ring.material.opacity = (1 - k) * 0.9
        })
        const b = pop / 0.8
        column.visible = b < 1
        if (column.visible) {
          column.scale.set(1 + b * 0.5, 1, 1 + b * 0.5)
          column.material.opacity = (1 - b) * 0.5
        }
        if (pop > 1.6) pop = -1
      }
      saw.rotation.z -= dt * (stages[1].busy ? 16 : 1.2)
      lamp.color.copy(lamp.userData.base).multiplyScalar(running ? 1.4 + Math.sin(elapsed * 5) * 0.9 : 0.5)
    },
  }
}
