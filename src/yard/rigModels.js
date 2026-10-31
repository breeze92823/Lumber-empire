import { BoxGeometry, CatmullRomCurve3, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, LatheGeometry, Mesh, MeshStandardMaterial, Shape, TubeGeometry, Vector2, Vector3 } from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { YARD } from '../config.js'
import { bake } from '../bake.js'
import { neon } from '../propkit.js'
import { bar, box, matte } from './kit.js'

// The four trucks of the Truck Level, by name (GAME.trucks.levels[].rig). Built nose-to-+Z with
// the floor at y = 0 and z = 0 midway along the drive axles, which is the point rig.js steers by.
// A truck is a tractor and maybe a trailer (its z = 0 midway along its axles), each a stiff frame
// plus a sprung cab, so a template is a few baked meshes that every rig clones.
let shared = null
const metal = () => (shared ??= {
  chrome: matte('#e8ecf2', { metalness: 0.95, roughness: 0.14 }),
  steel: matte('#8f949e', { metalness: 0.65, roughness: 0.42 }),
  dark: matte('#1c1e26', { roughness: 0.62 }),
  black: matte('#101116', { roughness: 0.8 }),
  glass: matte('#2c4a68', { metalness: 0.75, roughness: 0.06 }),
  lens: matte('#eef2ff', { emissive: '#c8d4ff', emissiveIntensity: 0.5, roughness: 0.2 }),
  red: matte('#7e1212', { roughness: 0.25 }),
  amber: matte('#b86a10', { roughness: 0.25 }),
  wood: matte('#b58a58'),
  woodDark: matte('#8a6238'),
})

// --- Shapes -----------------------------------------------------------------------
// A closed outline of [z, y, corner radius?] points.
function outline(pts) {
  const s = new Shape()
  pts.forEach((p, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length]
    const next = pts[(i + 1) % pts.length]
    const r = p[2] ?? 0
    const towards = (q) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
      const k = Math.min(r, len / 2) / len
      return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]
    }
    const [ax, ay] = r ? towards(prev) : p
    if (i === 0) s.moveTo(ax, ay)
    else s.lineTo(ax, ay)
    if (!r) return
    const [bx, by] = towards(next)
    s.quadraticCurveTo(p[0], p[1], bx, by)
  })
  s.closePath()
  return s
}

// A side profile pushed out across the truck, width centred on x.
function prism(parent, mat, pts, width, x = 0, bevel = 0.03) {
  const depth = Math.max(width - bevel * 2, 0.002)
  const raw = new ExtrudeGeometry(outline(pts), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 7, steps: 1 })
  raw.translate(0, 0, -depth / 2)
  const m = new Mesh(toCreasedNormals(raw, 0.7), mat)
  raw.dispose()
  m.rotation.y = -Math.PI / 2
  m.position.x = x
  parent.add(m)
  return m
}

// A curved guard over a wheel, from angle a0 to a1 (0 = towards the nose, PI/2 = up).
function arch(parent, mat, z, y, r, thick, width, x, a0 = 0.12, a1 = Math.PI - 0.12) {
  const pts = []
  const n = 12
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push([z + Math.cos(a) * (r + thick), y + Math.sin(a) * (r + thick)])
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push([z + Math.cos(a) * r, y + Math.sin(a) * r])
  }
  return prism(parent, mat, pts, width, x, 0.012)
}

function tube(parent, mat, pts, r) {
  const curve = new CatmullRomCurve3(pts.map(([x, y, z]) => new Vector3(x, y, z)))
  parent.add(new Mesh(new TubeGeometry(curve, pts.length * 7, r, 7), mat))
}

// A tapered round bar; `top` is the radius at the +axis end.
function cone(parent, mat, r, top, len, x, y, z, axis = 'y') {
  const m = new Mesh(new CylinderGeometry(top, r, len, 12), mat)
  m.position.set(x, y, z)
  if (axis === 'z') m.rotation.x = Math.PI / 2
  if (axis === 'x') m.rotation.z = -Math.PI / 2
  parent.add(m)
}

// The lamps that switch: each set is merged and shown only while lit.
const lampSet = () => ({ head: new Group(), brake: new Group(), reverse: new Group(), left: new Group(), right: new Group() })

function tailLamps(g, lamps, M, W, y, z) {
  box(g, M.dark, W - 0.1, 0.34, 0.1, 0, y, z)
  for (const s of [-1, 1]) {
    const x = (s * W) / 2
    box(g, M.red, 0.3, 0.2, 0.06, x - s * 0.28, y, z - 0.06)
    box(g, M.amber, 0.2, 0.2, 0.06, x - s * 0.58, y, z - 0.06)
    box(g, M.lens, 0.16, 0.2, 0.06, x - s * 0.82, y, z - 0.06)
    box(lamps.brake, neon('#ff2418', 4), 0.32, 0.22, 0.05, x - s * 0.28, y, z - 0.1)
    box(s > 0 ? lamps.left : lamps.right, neon('#ffa01e', 4), 0.22, 0.22, 0.05, x - s * 0.58, y, z - 0.1)
    box(lamps.reverse, neon('#ffffff', 3), 0.18, 0.22, 0.05, x - s * 0.82, y, z - 0.1)
  }
}

// --- Wheels -----------------------------------------------------------------------
// One vertex-coloured mesh per axle, so spinning it is one matrix and one draw call.
const lathe = (pts, color, sides = 26) => paintGeo(new LatheGeometry(pts.map(([r, x]) => new Vector2(r, x)), sides).rotateZ(-Math.PI / 2), color)
function paintGeo(geo, color) {
  const out = geo.index ? geo.toNonIndexed() : geo
  out.deleteAttribute('uv')
  const c = new Color(color)
  const n = out.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3)
  out.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return out
}

// A tyre with its outer face at +x.
function wheelGeo(r, w, rim) {
  const hub = r * 0.56
  const h = w / 2
  const parts = [
    lathe([[hub, -h], [r * 0.9, -h], [r * 0.97, -h + 0.05], [r, -h + 0.13], [r, h - 0.13], [r * 0.97, h - 0.05], [r * 0.9, h], [hub, h]], '#17181d', 30),
    lathe([[hub, h + 0.005], [hub * 0.92, h - 0.1], [hub * 0.56, h - 0.14], [hub * 0.5, h - 0.06], [hub * 0.3, h - 0.05], [hub * 0.26, h + 0.05], [0.001, h + 0.05]], rim),
    lathe([[0.001, -h + 0.06], [hub * 0.4, -h + 0.06], [hub, -h - 0.005]], '#3a3c44', 14),
  ]
  // Tread blocks, hand holes and wheel nuts: what shows the wheel turning.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    const lug = paintGeo(new CylinderGeometry(0.06, 0.06, w - 0.26, 5).rotateZ(Math.PI / 2), '#0c0d10')
    parts.push(lug.translate(0, Math.cos(a) * r, Math.sin(a) * r))
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const hole = paintGeo(new CylinderGeometry(hub * 0.15, hub * 0.15, 0.03, 9).rotateZ(Math.PI / 2), '#191a20')
    parts.push(hole.translate(h - 0.115, Math.cos(a) * hub * 0.72, Math.sin(a) * hub * 0.72))
    const nut = paintGeo(new CylinderGeometry(0.035, 0.035, 0.06, 6).rotateZ(Math.PI / 2), '#f1f2f5')
    parts.push(nut.translate(h - 0.03, Math.cos(a + 0.39) * hub * 0.4, Math.sin(a + 0.39) * hub * 0.4))
  }
  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  return merged
}

const wheelMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 })
const pieces = (geo, x, flip) => {
  const g = geo.clone()
  if (flip) g.rotateY(Math.PI)
  return g.translate(x, 0, 0)
}

// Both wheels (twin tyres if `dual`) and the tube between them, as one geometry around y = 0.
function axleGeo(r, w, track, rim, dual) {
  const wheel = wheelGeo(r, w, rim)
  const parts = []
  for (const s of [-1, 1]) {
    parts.push(pieces(wheel, s * track, s < 0))
    if (dual) parts.push(pieces(wheel, s * (track - w - 0.03), s < 0))
  }
  parts.push(paintGeo(new CylinderGeometry(0.1, 0.1, track * 2, 8).rotateZ(Math.PI / 2), '#23252e'))
  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  wheel.dispose()
  return merged
}

function addAxle(unit, geo, r, z) {
  const m = new Mesh(geo, wheelMat)
  m.position.set(0, r, z)
  m.castShadow = true
  m.userData.spin = r
  unit.add(m)
}

// A steered wheel: the pivot takes the steering, the mesh in it the spin.
function addSteered(unit, geo, r, x, z) {
  const pivot = new Group()
  pivot.position.set(x, r, z)
  pivot.userData.steer = true
  const m = new Mesh(geo, wheelMat)
  m.castShadow = true
  m.userData.spin = r
  pivot.add(m)
  unit.add(pivot)
}

function addFlaps(unit, M, x, y, z, w) {
  const hinge = new Group()
  hinge.position.set(x, y, z)
  box(hinge, M.black, w, 0.62, 0.03, 0, -0.31, 0)
  box(hinge, M.chrome, w * 0.7, 0.05, 0.035, 0, -0.08, 0)
  const baked = bake(hinge, true, false)
  baked.position.copy(hinge.position)
  baked.userData.flap = true
  unit.add(baked)
}

// --- Prime movers -----------------------------------------------------------------
// o: r tyre radius, tyre width, W cab width, track half-track, steer z of the front axle, over nose
// past it, hoodBack firewall behind it, cabL, H roof, hoodY, kingpin, drive [z of each axle],
// tail frame past the last axle, and the fittings: sleeper, bullBar, stacks, headacheRack.
function primeMover(o, paint, trim) {
  const M = metal()
  const { r, W, track, steer, over, cabL, H, hoodY, kingpin } = o
  const nose = steer + over
  const cabFront = steer - o.hoodBack
  const cabBack = cabFront - cabL
  const bot = r * 2 + 0.1
  const frameY = r * 1.5
  const floor = r * 2 + 0.05
  const tailZ = Math.min(...o.drive) - o.tail
  const frame = new Group()
  const cab = new Group()
  const lamps = lampSet()

  // Ladder frame, cross members, fifth wheel and everything slung off the rails.
  const rails = nose - 0.5 - tailZ
  for (const s of [-1, 1]) box(frame, M.dark, 0.16, 0.36, rails, s * 0.54, frameY, tailZ + rails / 2)
  for (let z = tailZ + 0.3; z < nose - 0.6; z += 0.9) box(frame, M.dark, 1.1, 0.14, 0.14, 0, frameY, z)
  box(frame, M.steel, 1.5, 0.12, 1.1, 0, frameY + 0.24, kingpin)
  box(frame, M.dark, 0.3, 0.13, 0.6, 0, frameY + 0.25, kingpin - 0.34)
  for (const s of [-1, 1]) box(frame, M.dark, 0.12, 0.2, 0.7, s * 0.48, frameY + 0.12, kingpin)
  for (const z of o.drive) box(frame, M.steel, 1.6, 0.16, 0.26, 0, r, z)
  // Fuel tanks between the axles with the steps over them, air tanks on the other rail.
  const tankZ = (cabBack + steer - 1) / 2
  const tankL = Math.max(1.3, o.tanks)
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.42)
    bar(frame, M.chrome, 0.38, tankL, x, frameY - 0.12, tankZ, 'z', 18)
    for (const dz of [-tankL * 0.3, tankL * 0.3]) bar(frame, M.dark, 0.395, 0.07, x, frameY - 0.12, tankZ + dz, 'z', 18)
    box(frame, M.dark, 0.5, 0.05, 0.08, s * 0.7, frameY - 0.1, tankZ - tankL * 0.3)
    box(frame, M.steel, 0.6, 0.05, tankL * 0.9, x, frameY + 0.3, tankZ)
    bar(frame, M.steel, 0.14, 0.9, s * 0.86, frameY - 0.3, tailZ + 1.1 + o.drive.length, 'z', 10)
  }
  // Drive axle mudguards and the flaps behind them.
  const lastDrive = Math.min(...o.drive)
  for (const s of [-1, 1]) {
    const x = s * (track - o.tyre / 2 - 0.02)
    arch(frame, M.dark, lastDrive, r, r + 0.1, 0.05, o.tyre * 2 + 0.2, x, 0.5, Math.PI)
    box(frame, M.steel, 0.5, 0.05, 0.06, s * 0.82, frameY + 0.1, lastDrive)
  }
  // Air lines from the cab's back, coiled for the trailer.
  for (const [dx, tint] of [[-0.2, '#2f5fd0'], [0.05, '#d03030'], [0.3, '#e0c030']]) {
    tube(frame, matte(tint), [[dx, frameY + 1.15, cabBack - 0.03], [dx * 1.1, frameY + 1.0, cabBack - 0.45], [dx, frameY + 0.72, cabBack - 0.75], [dx * 0.8, frameY + 0.62, kingpin + 0.7]], 0.022)
  }

  // Engine, hood, guards.
  box(cab, M.dark, 1.5, bot + 0.1 - r, nose - cabFront - 0.35, 0, (bot + 0.1 + r) / 2, (nose + cabFront) / 2 - 0.1)
  prism(cab, paint, [[cabFront - 0.02, bot], [nose - 0.14, bot, 0.1], [nose, bot + 0.3, 0.14], [nose - 0.06, hoodY - 0.24, 0.32], [cabFront + 0.6, hoodY - 0.02, 0.5], [cabFront - 0.02, hoodY]], W - 0.4, 0, 0.06)
  for (const s of [-1, 1]) {
    arch(cab, paint, steer, r, r + 0.08, 0.07, o.tyre + 0.16, s * track, 0.02, Math.PI - 0.02)
    box(cab, paint, o.tyre + 0.16, 0.07, steer - r - cabFront + 0.1, s * track, r + 0.03, (steer - r + cabFront) / 2 - 0.02)
    box(cab, M.chrome, 0.05, 0.07, steer - cabFront - 0.2, s * (W / 2 - 0.19), hoodY - 0.46, cabFront + 0.46 + (steer - cabFront) / 2)
    for (let i = 0; i < 6; i++) box(cab, M.dark, 0.04, 0.5, 0.05, s * (W / 2 - 0.2), bot + 0.4, cabFront + 0.3 + i * 0.13)
  }
  // Grille: chrome surround, dark core, bars, badge.
  const gBot = bot + 0.04
  const gTop = hoodY - 0.2
  const gW = W - 1.25
  const gMid = (gBot + gTop) / 2
  box(cab, M.chrome, gW + 0.18, gTop - gBot + 0.18, 0.1, 0, gMid, nose)
  box(cab, M.black, gW, gTop - gBot, 0.1, 0, gMid, nose + 0.04)
  for (let i = 0; i < 9; i++) box(cab, M.chrome, 0.05, gTop - gBot, 0.05, -gW / 2 + 0.07 + (i * (gW - 0.14)) / 8, gMid, nose + 0.08)
  for (const y of [gBot + 0.25, gTop - 0.25]) box(cab, M.chrome, gW, 0.04, 0.05, 0, y, nose + 0.08)
  bar(cab, trim, 0.13, 0.05, 0, gTop + 0.09, nose + 0.05, 'z', 12)
  box(cab, M.chrome, 0.05, 0.28, 0.04, 0, gTop + 0.22, nose - 0.01)
  // Headlamps in chrome buckets on the guards, indicators outboard.
  for (const s of [-1, 1]) {
    const x = s * (track - 0.03)
    const y = r * 2 + 0.12
    const z = steer + 0.3
    cone(cab, M.chrome, 0.2, 0.25, 0.3, x, y, z, 'z')
    bar(cab, M.lens, 0.21, 0.03, x, y, z + 0.16, 'z', 16)
    bar(lamps.head, neon('#fff6d8', 5), 0.21, 0.04, x, y, z + 0.17, 'z', 16)
    box(cab, M.amber, 0.26, 0.12, 0.08, x, y - 0.3, z + 0.05)
    box(s > 0 ? lamps.left : lamps.right, neon('#ffa01e', 4), 0.27, 0.13, 0.05, x, y - 0.3, z + 0.1)
  }
  // Bumper, fog lamps, tow pin.
  const by = r * 0.82
  prism(cab, M.chrome, [[nose - 0.3, by], [nose + 0.2, by, 0.1], [nose + 0.2, by + 0.46, 0.1], [nose - 0.3, by + 0.46]], W + 0.04, 0, 0.04)
  for (const s of [-1, 1]) {
    box(cab, M.black, 0.42, 0.16, 0.05, s * 0.86, by + 0.23, nose + 0.2)
    box(cab, M.lens, 0.3, 0.1, 0.05, s * 0.86, by + 0.23, nose + 0.22)
  }
  box(cab, M.black, 0.8, 0.2, 0.05, 0, by + 0.23, nose + 0.21)
  box(cab, M.steel, 0.4, 0.06, 0.1, 0, by - 0.08, nose - 0.05)

  // The cab shell, raked windscreen and roof. A sleeper lifts the back of the roof.
  const rake = cabFront - 0.56
  prism(cab, paint, [[cabBack, floor], [cabFront + 0.04, floor], [cabFront + 0.04, hoodY + 0.02], [rake, H, 0.16], [cabBack, H, 0.14]], W, 0, 0.05)
  const screen = Math.hypot(cabFront - rake, H - hoodY)
  const lean = Math.atan2(cabFront - rake, H - hoodY)
  const midZ = (cabFront + rake) / 2 + 0.04
  const midY = (hoodY + H) / 2
  box(cab, M.black, W - 0.2, screen - 0.1, 0.05, 0, midY, midZ, 0, lean)
  for (const s of [-1, 1]) {
    box(cab, M.glass, W / 2 - 0.2, screen - 0.26, 0.05, (s * (W / 2 - 0.08)) / 2, midY, midZ + 0.03, 0, lean)
    // Wipers, parked on the cowl.
    box(cab, M.black, 0.03, 0.03, 0.8, s * 0.55 - 0.2, hoodY + 0.14, cabFront - 0.04, 1.42)
    // Door: window with its frame, seam lines, handle, step into it.
    const fz = cabFront - 0.12
    const bz = fz - 0.98
    const x = s * (W / 2 + 0.006)
    prism(cab, M.black, [[bz - 0.04, hoodY - 0.1], [fz + 0.02, hoodY - 0.1], [rake + 0.06, H - 0.1], [bz - 0.04, H - 0.1]], 0.02, x, 0)
    prism(cab, M.glass, [[bz, hoodY - 0.06], [fz - 0.03, hoodY - 0.06], [rake + 0.1, H - 0.15], [bz, H - 0.15]], 0.03, x + s * 0.004, 0)
    box(cab, M.black, 0.02, H - floor - 0.3, 0.03, x, (H + floor) / 2 - 0.15, bz - 0.09)
    box(cab, M.black, 0.02, 0.03, 1.08, x, floor + 0.06, bz + 0.45)
    box(cab, M.chrome, 0.05, 0.05, 0.22, x + s * 0.02, hoodY - 0.28, bz + 0.1)
    box(cab, trim, 0.02, 0.2, cabL, x, floor + 0.46, cabFront - cabL / 2)
    box(cab, trim, 0.02, 0.2, nose - cabFront - 0.15, s * (W / 2 - 0.195), floor + 0.46, (nose + cabFront) / 2 - 0.05)
    for (let i = 0; i < 2; i++) box(frame, M.chrome, 0.4, 0.05, 0.62, s * (W / 2 - 0.1), floor - 0.22 - i * 0.28, cabFront - 0.56)
    box(frame, M.steel, 0.04, 0.6, 0.04, s * (W / 2 + 0.09), floor - 0.3, cabFront - 0.24)
    // West coast mirror on two arms.
    const mx = s * (W / 2 + 0.34)
    const mz = rake + 0.12
    box(cab, M.chrome, 0.38, 0.04, 0.04, s * (W / 2 + 0.16), hoodY + 0.12, mz)
    box(cab, M.chrome, 0.38, 0.04, 0.04, s * (W / 2 + 0.16), H - 0.3, mz)
    box(cab, M.black, 0.2, H - hoodY - 0.28, 0.08, mx, (H + hoodY) / 2 - 0.09, mz)
    box(cab, M.chrome, 0.21, H - hoodY - 0.32, 0.03, mx, (H + hoodY) / 2 - 0.09, mz + 0.05)
    // Air horn on the roof edge.
    cone(cab, M.chrome, 0.05, 0.11, 0.65, s * 0.5, H + 0.12, cabBack + 0.9, 'z')
  }
  box(cab, M.black, 0.07, screen - 0.26, 0.06, 0, midY, midZ + 0.03, 0, lean)
  // Sun visor and the five roof lamps.
  prism(cab, paint, [[rake + 0.34, H - 0.1], [rake - 0.06, H + 0.02], [rake - 0.04, H - 0.02], [rake + 0.3, H - 0.22]], W - 0.1, 0, 0.012)
  for (let i = 0; i < 5; i++) box(cab, neon('#ffb030', 1.4), 0.15, 0.07, 0.1, -0.76 + i * 0.38, H + 0.05, rake - 0.1)
  if (o.sleeper) {
    const back = cabBack + 0.02
    const front = cabBack + 1.45
    const top = H + o.sleeper
    prism(cab, paint, [[front + 0.55, H - 0.02], [front, top - 0.08, 0.5], [front - 0.3, top, 0.3], [back, top, 0.14], [back, H - 0.1]], W - 0.1, 0, 0.04)
    for (const s of [-1, 1]) {
      box(cab, M.glass, 0.02, 0.32, 0.5, s * (W / 2 - 0.045), H + 0.2, back + 0.5)
      box(cab, trim, 0.02, 0.14, 1.2, s * (W / 2 - 0.045), H + 0.55, back + 0.62)
    }
    for (let i = 0; i < 4; i++) box(cab, neon('#ffb030', 1.4), 0.15, 0.07, 0.1, -0.57 + i * 0.38, top + 0.04, front - 0.1)
  }

  // Exhaust stacks, heat shields, and the rack behind the cab.
  const stackTop = H + (o.sleeper || 0) + o.stackUp
  const stackZ = cabBack - 0.16
  const stacks = []
  for (const s of o.stacks) {
    const x = s * (W / 2 - 0.2)
    bar(frame, M.chrome, 0.1, stackTop - frameY, x, (stackTop + frameY) / 2, stackZ, 'y', 12)
    bar(frame, M.steel, 0.135, 1.1, x, frameY + 1.1, stackZ, 'y', 12)
    for (let i = 0; i < 6; i++) bar(frame, M.dark, 0.14, 0.05, x, frameY + 0.68 + i * 0.17, stackZ, 'y', 12)
    bar(frame, M.dark, 0.12, 0.14, x, stackTop + 0.04, stackZ, 'y', 12)
    box(frame, M.steel, 0.08, 0.06, 0.2, x, frameY + 2, stackZ + 0.13)
    stacks.push([x, stackTop + 0.18, stackZ])
  }
  if (o.headacheRack) {
    for (const s of [-1, 1]) box(frame, M.steel, 0.1, H - floor, 0.1, s * (W / 2 - 0.28), (H + floor) / 2, cabBack - 0.32)
    for (let i = 0; i < 5; i++) box(frame, M.steel, W - 0.5, 0.05, 0.05, 0, floor + 0.24 + i * ((H - floor - 0.3) / 4), cabBack - 0.32)
  }
  if (o.bullBar) {
    const bz = nose + 0.42
    const top = hoodY + 0.1
    for (const x of [-1.2, -0.46, 0.46, 1.2]) {
      bar(cab, M.chrome, 0.06, top - by, x, (top + by) / 2, bz, 'y', 9)
      bar(cab, M.chrome, 0.05, 0.3, x, by + 0.2, bz - 0.16, 'z', 8)
    }
    for (const [y, half] of [[top, 1.2], [hoodY - 0.5, 1.4], [by + 0.5, 1.62]]) bar(cab, M.chrome, 0.06, half * 2, 0, y, bz, 'x', 9)
    for (const s of [-1, 1]) {
      bar(cab, M.black, 0.15, 0.16, s * 0.82, top - 0.02, bz + 0.1, 'z', 12)
      bar(cab, M.lens, 0.11, 0.04, s * 0.82, top - 0.02, bz + 0.18, 'z', 12)
    }
  }
  if (o.intakes) {
    for (const s of [-1, 1]) {
      const x = s * (W / 2 + 0.2)
      bar(cab, M.chrome, 0.26, 1.2, x, hoodY + 0.3, cabFront - 0.1, 'y', 14)
      bar(cab, M.dark, 0.27, 0.06, x, hoodY + 0.9, cabFront - 0.1, 'y', 14)
      box(cab, M.chrome, 0.3, 0.06, 0.1, x - s * 0.16, hoodY + 0.5, cabFront - 0.1)
    }
  }
  if (o.neon) {
    const glow = neon(o.neon, 3)
    for (const s of [-1, 1]) {
      box(cab, glow, 0.05, 0.06, cabL, s * (W / 2 + 0.03), floor + 0.08, cabFront - cabL / 2)
      box(cab, glow, 0.05, 0.05, nose - cabFront - 0.2, s * (W / 2 - 0.17), bot + 0.02, (nose + cabFront) / 2 - 0.05)
    }
    box(cab, glow, W - 0.7, 0.07, 0.07, 0, H - 0.04, rake + 0.1)
    box(cab, glow, gW + 0.2, 0.06, 0.05, 0, gBot - 0.1, nose + 0.05)
  }
  if (o.lightBar) {
    const y = H + (o.sleeper || 0) + 0.12
    box(cab, M.black, W - 0.4, 0.14, 0.14, 0, y, cabBack + 1.05)
    for (let i = 0; i < 4; i++) box(cab, M.lens, 0.34, 0.1, 0.03, -0.81 + i * 0.54, y, cabBack + 1.13)
  }
  if (o.skirt) {
    for (const s of [-1, 1]) {
      box(frame, paint, 0.05, 0.55, tankL + 0.6, s * (W / 2 + 0.03), frameY - 0.35, tankZ)
      box(frame, trim, 0.055, 0.08, tankL + 0.6, s * (W / 2 + 0.03), frameY - 0.1, tankZ)
    }
  }
  return { frame, cab, lamps, stacks, nose, frameY }
}

function fitWheels(unit, o) {
  const rim = o.rim
  const steer = wheelGeo(o.r, o.tyre, rim)
  for (const s of [-1, 1]) {
    addSteered(unit, s > 0 ? steer : steer.clone().rotateY(Math.PI), o.r, s * o.track, o.steer)
  }
  const drive = axleGeo(o.r, o.tyre, o.track, rim, true)
  for (const z of o.drive) addAxle(unit, drive, o.r, z)
}

// --- Trailers ---------------------------------------------------------------------
// o: r, tyre, track, rim, W, reach = axles to kingpin, front past the kingpin, tail past the axles,
// axles [z], deckY, and paint or wood deck.
function trailerFrame(o, paint, trim, M) {
  const { r, W, reach, front, tail, deckY } = o
  const g = new Group()
  const lamps = lampSet()
  const nose = reach + front
  const len = nose + tail
  const mid = (nose - tail) / 2
  const beamY = deckY - 0.28
  for (const s of [-1, 1]) box(g, M.dark, 0.18, 0.46, len - 0.1, s * 0.5, beamY, mid)
  box(g, paint, W, 0.16, len, 0, deckY - 0.08, mid)
  for (const s of [-1, 1]) {
    box(g, trim, 0.05, 0.05, len, (s * W) / 2, deckY - 0.1, mid)
    // Marker lamps down the side.
    for (let i = 0; i < 4; i++) box(g, M.amber, 0.04, 0.06, 0.14, (s * W) / 2, deckY - 0.2, mid - len / 2 + 0.6 + (i * (len - 1.2)) / 3)
    // Landing legs with their crank.
    box(g, M.steel, 0.14, deckY - 0.46, 0.14, s * 0.76, (deckY + 0.3) / 2 + 0.02, reach - 1.15)
    box(g, M.dark, 0.34, 0.06, 0.34, s * 0.76, 0.36, reach - 1.15)
  }
  box(g, M.steel, 1.6, 0.06, 0.06, 0, deckY - 0.58, reach - 1.15)
  box(g, M.steel, 0.07, 0.34, 0.07, W / 2 - 0.2, deckY - 0.72, reach - 1.15)
  box(g, M.steel, 0.7, 0.12, 0.7, 0, deckY - 0.52, reach) // the plate on the fifth wheel
  bar(g, M.chrome, 0.05, 0.3, 0, deckY - 0.66, reach, 'y', 8)
  // Bogie: hangers, guards over the tyres, and the toolbox forward of it.
  const axles = o.axles
  const first = Math.max(...axles)
  const last = Math.min(...axles)
  for (const s of [-1, 1]) {
    const x = s * (o.track - o.tyre / 2 - 0.01)
    for (const z of axles) {
      box(g, M.dark, 0.14, deckY - r - 0.3, 0.24, s * 0.56, (deckY - 0.3 + r) / 2, z)
      arch(g, M.dark, z, r, r + 0.08, 0.04, o.tyre * 2 + 0.16, x, 0.3, Math.PI - 0.3)
    }
    box(g, M.steel, 0.12, 0.12, first - last + 0.6, s * 0.56, r, (first + last) / 2)
  }
  box(g, M.steel, 0.9, 0.5, 0.9, -W / 2 + 0.5, deckY - 0.5, first + r + 0.5)
  box(g, M.chrome, 0.03, 0.04, 0.2, -W / 2 + 0.06, deckY - 0.42, first + r + 0.5)
  // Rear: underrun bar and lamp panel.
  for (const s of [-1, 1]) box(g, M.steel, 0.1, 0.5, 0.1, s * 0.6, deckY - 0.5, -tail + 0.14)
  box(g, M.dark, W - 0.3, 0.1, 0.1, 0, deckY - 0.76, -tail + 0.1)
  tailLamps(g, lamps, M, W, deckY - 0.42, -tail + 0.02)
  return { g, lamps, mid, len, nose }
}

function stakes(g, o, mat, M, count, height, y) {
  const { W, reach, front, tail } = o
  for (const s of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const z = -tail + 0.3 + (i * (reach + front + tail - 0.7)) / (count - 1)
      box(g, mat, 0.12, height, 0.12, s * (W / 2 - 0.03), y + height / 2, z)
      box(g, M.steel, 0.16, 0.14, 0.16, s * (W / 2 - 0.03), y + 0.07, z)
    }
  }
}

function headboard(g, o, paint, M, height) {
  const z = o.reach + o.front - 0.1
  const y = o.deckY
  box(g, paint, o.W, 0.1, 0.12, 0, y + height, z)
  for (const s of [-1, 1]) box(g, paint, 0.14, height, 0.12, s * (o.W / 2 - 0.07), y + height / 2, z)
  for (let i = 0; i < 5; i++) box(g, M.steel, o.W - 0.3, 0.1, 0.06, 0, y + 0.18 + (i * (height - 0.3)) / 4, z)
  for (let i = 0; i < 3; i++) box(g, M.steel, 0.08, height, 0.06, -0.8 + i * 0.8, y + height / 2, z)
}

// A plank deck with its boards marked out.
function deckBoards(g, o, M) {
  const len = o.reach + o.front + o.tail - 0.2
  const mid = (o.reach + o.front - o.tail) / 2
  box(g, M.wood, o.W - 0.2, 0.05, len, 0, o.deckY + 0.02, mid)
  for (let i = 1; i < 7; i++) box(g, M.woodDark, 0.025, 0.055, len, -(o.W - 0.2) / 2 + (i * (o.W - 0.2)) / 7, o.deckY + 0.02, mid)
}

// What a load is made of. One item = one instance; `slots` fill front to back, bottom to top.
function bundleGeo(w, h, l) {
  const parts = []
  const tone = ['#e3c493', '#d8b57f', '#e8cfa3', '#cda872']
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const pw = w / 4 - 0.008
      const ph = h / 3 - 0.008
      parts.push(paintGeo(new BoxGeometry(pw, ph, l), tone[(row * 3 + col) % 4]).translate((col - 1.5) * (w / 4), (row - 1) * (h / 3), 0))
    }
  }
  for (const z of [-l * 0.3, l * 0.3]) {
    parts.push(paintGeo(new BoxGeometry(w + 0.03, h + 0.03, 0.05), '#23262e').translate(0, 0, z))
  }
  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  return merged
}
function logGeo(r, l) {
  const parts = [
    paintGeo(new CylinderGeometry(r, r * 1.04, l, 10).rotateX(Math.PI / 2), '#8a5a30'),
    paintGeo(new CylinderGeometry(r * 0.92, r * 0.92, l + 0.03, 10).rotateX(Math.PI / 2), '#dfc08d'),
  ]
  // The second cylinder only shows at the ends: the sawn faces. Bark ridges break up the sides.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    parts.push(paintGeo(new CylinderGeometry(0.03, 0.03, l * 0.9, 4).rotateX(Math.PI / 2), '#6e4426').translate(Math.cos(a) * r, Math.sin(a) * r, 0))
  }
  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  return merged
}

function grid(cols, rows, layers, cw, cl, h, y, z0) {
  const slots = []
  for (let layer = 0; layer < layers; layer++) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) slots.push([(col - (cols - 1) / 2) * cw, y + h / 2 + layer * h, z0 - row * cl])
    }
  }
  return slots
}

// --- The four trucks --------------------------------------------------------------
// The stiff frame with the cab sprung on it, pivoting at (y, z); the switched lamps ride the cab.
function sprungUnit(frame, cab, y, z, lamps) {
  const unit = new Group()
  unit.add(bake(frame, true, true))
  const sprung = new Group()
  sprung.name = 'sprung'
  sprung.position.set(0, y, z)
  const baked = bake(cab, true, true)
  baked.position.set(0, -y, -z)
  sprung.add(baked)
  unit.add(sprung)
  bakeLamps(sprung, lamps, baked.position)
  return unit
}

function bakeLamps(parent, lamps, offset = null) {
  for (const [name, group] of Object.entries(lamps)) {
    if (!group.children.length) continue
    const m = bake(group, false, false)
    m.name = `lamp-${name}`
    m.visible = false
    if (offset) m.position.copy(offset)
    parent.add(m)
  }
}

function starter(C) {
  const M = metal()
  const paint = rigPaint(C.paint)
  const trim = matte(C.trim)
  const o = { r: 0.54, tyre: 0.34, track: 1.02, steer: 3.1, rim: C.rim, drive: [0], W: 2.46 }
  const { W } = o
  const nose = 4.2
  const face = nose + 0.075 // the shell's bevel stands proud of the outline
  const back = 2.28
  const floor = 1.14
  const roof = 3.18
  const frame = new Group()
  const cab = new Group()
  const lamps = lampSet()

  // Frame, tank, the drive axle's hanger.
  for (const s of [-1, 1]) box(frame, M.dark, 0.12, 0.26, 6.3, s * 0.46, 0.92, 0.92)
  for (let z = -2.1; z < 3.8; z += 0.9) box(frame, M.dark, 0.9, 0.1, 0.1, 0, 0.92, z)
  bar(frame, M.steel, 0.28, 1, W / 2 - 0.34, 0.74, 1.3, 'z', 14)
  box(frame, M.dark, 0.5, 0.42, 0.7, -W / 2 + 0.36, 0.74, 1.3)
  box(frame, M.steel, 1.3, 0.14, 0.22, 0, 0.54, 0)
  for (const s of [-1, 1]) box(frame, M.steel, 0.06, 0.05, 2.4, s * (W / 2 - 0.06), 0.72, 1.1)
  bar(frame, M.steel, 0.07, 1.8, -W / 2 + 0.3, 0.86, 2.4, 'z', 8)

  // Tilt cab: blunt, rounded, with its wheel under the door.
  prism(cab, paint, [[back, floor], [nose - 0.02, floor], [nose, 1.6, 0.12], [nose - 0.28, roof - 0.04, 0.3], [back, roof, 0.16]], W, 0, 0.07)
  for (const s of [-1, 1]) {
    arch(cab, paint, o.steer, o.r, o.r + 0.08, 0.1, 0.5, s * (W / 2 - 0.2), 0.08, Math.PI - 0.08)
    box(cab, M.chrome, 0.26, 0.05, 0.5, s * (W / 2 - 0.13), 0.84, back + 0.28) // step
    const x = s * (W / 2 + 0.005)
    prism(cab, M.black, [[back + 0.26, 2.02], [nose - 0.24, 2.02], [nose - 0.42, roof - 0.16], [back + 0.26, roof - 0.16]], 0.02, x, 0)
    prism(cab, M.glass, [[back + 0.3, 2.06], [nose - 0.3, 2.06], [nose - 0.46, roof - 0.2], [back + 0.3, roof - 0.2]], 0.03, x + s * 0.004, 0)
    box(cab, M.black, 0.02, roof - floor - 0.3, 0.03, x, (roof + floor) / 2 - 0.1, back + 0.2)
    box(cab, M.chrome, 0.05, 0.05, 0.2, x + s * 0.02, 1.86, back + 0.42)
    box(cab, trim, 0.02, 0.14, nose - back - 0.12, x, 1.6, (nose + back) / 2 - 0.06)
    const mx = s * (W / 2 + 0.26)
    box(cab, M.black, 0.32, 0.04, 0.04, s * (W / 2 + 0.12), 2.86, nose - 0.5)
    box(cab, M.black, 0.32, 0.04, 0.04, s * (W / 2 + 0.12), 2.2, nose - 0.3)
    box(cab, M.black, 0.16, 0.76, 0.08, mx, 2.5, nose - 0.42)
    box(cab, M.chrome, 0.17, 0.72, 0.03, mx, 2.5, nose - 0.37)
    // Face lamps.
    const lx = s * (W / 2 - 0.34)
    box(cab, M.black, 0.56, 0.32, 0.05, lx, 1.5, face)
    box(cab, M.lens, 0.36, 0.24, 0.05, lx - s * 0.08, 1.5, face + 0.02)
    box(cab, M.amber, 0.12, 0.24, 0.05, lx + s * 0.19, 1.5, face + 0.02)
    box(lamps.head, neon('#fff6d8', 5), 0.36, 0.24, 0.05, lx - s * 0.08, 1.5, face + 0.04)
    box(s > 0 ? lamps.left : lamps.right, neon('#ffa01e', 4), 0.13, 0.25, 0.05, lx + s * 0.19, 1.5, face + 0.04)
  }
  // Windscreen in two panes over a slotted grille.
  const lean = Math.atan2(0.26, 1.08)
  box(cab, M.black, W - 0.2, 1.16, 0.05, 0, 2.54, face - 0.17, 0, lean)
  for (const s of [-1, 1]) box(cab, M.glass, W / 2 - 0.2, 1, 0.05, (s * (W / 2 - 0.1)) / 2, 2.54, face - 0.14, 0, lean)
  for (let i = 0; i < 4; i++) box(cab, M.black, 1.1, 0.05, 0.04, 0, 1.36 + i * 0.1, face)
  box(cab, trim, 0.26, 0.26, 0.04, 0, 1.86, face - 0.03)
  box(cab, M.black, 0.03, 0.03, 0.7, -0.5, 2, face - 0.02, 1.45)
  box(cab, M.black, 0.03, 0.03, 0.7, 0.42, 2, face - 0.02, 1.45)
  prism(cab, M.dark, [[nose - 0.3, 0.74], [nose + 0.16, 0.74, 0.08], [nose + 0.16, 1.12, 0.08], [nose - 0.3, 1.12]], W + 0.02, 0, 0.03)
  for (const s of [-1, 1]) box(cab, M.lens, 0.3, 0.1, 0.04, s * 0.85, 0.93, nose + 0.17)
  box(cab, M.chrome, 0.5, 0.08, 0.05, 0, 0.93, nose + 0.17)
  for (let i = 0; i < 3; i++) box(cab, neon('#ffb030', 1.4), 0.15, 0.06, 0.1, -0.3 + i * 0.3, roof + 0.04, nose - 0.5)
  box(cab, M.chrome, 0.02, 0.5, 0.02, -W / 2 + 0.3, roof + 0.25, back + 0.3) // radio mast
  bar(frame, M.chrome, 0.06, 2.3, W / 2 - 0.14, 2.16, back - 0.1, 'y', 10)
  bar(frame, M.dark, 0.075, 0.5, W / 2 - 0.14, 1.5, back - 0.1, 'y', 10)
  const stacks = [[W / 2 - 0.14, 3.4, back - 0.1]]

  // Stake bed with drop sides, head rack over the cab's back.
  const bedY = 1.28
  const bedL = 4.3
  const bedZ = -0.14
  box(frame, M.dark, W - 0.04, 0.12, bedL + 0.1, 0, bedY - 0.1, bedZ)
  box(frame, M.wood, W - 0.2, 0.05, bedL - 0.1, 0, bedY, bedZ)
  for (let i = 1; i < 6; i++) box(frame, M.woodDark, 0.025, 0.055, bedL - 0.1, -(W - 0.2) / 2 + (i * (W - 0.2)) / 6, bedY, bedZ)
  for (const s of [-1, 1]) {
    for (let y = 0; y < 3; y++) box(frame, y === 2 ? paint : M.wood, 0.06, 0.26, bedL, s * (W / 2 - 0.05), bedY + 0.22 + y * 0.34, bedZ)
    for (let i = 0; i < 5; i++) box(frame, M.steel, 0.09, 1.14, 0.08, s * (W / 2 - 0.05), bedY + 0.52, bedZ - bedL / 2 + 0.2 + i * ((bedL - 0.4) / 4))
    arch(frame, M.dark, 0, o.r, o.r + 0.1, 0.05, o.tyre * 2 + 0.16, s * (o.track - o.tyre / 2), 0.25, Math.PI - 0.25)
  }
  for (let y = 0; y < 3; y++) box(frame, y === 2 ? paint : M.wood, W - 0.1, 0.26, 0.06, 0, bedY + 0.22 + y * 0.34, bedZ - bedL / 2)
  box(frame, M.dark, W - 0.2, 1.7, 0.08, 0, bedY + 0.8, back - 0.3)
  for (let i = 0; i < 4; i++) box(frame, M.steel, W - 0.3, 0.05, 0.1, 0, bedY + 0.4 + i * 0.42, back - 0.34)
  const tailZ = bedZ - bedL / 2 - 0.04
  const tail = lampSet()
  tailLamps(frame, tail, M, W, 0.92, tailZ)
  for (const s of [-1, 1]) box(frame, M.steel, 0.09, 0.26, 0.09, s * 0.56, 0.72, tailZ + 0.1)
  box(frame, M.steel, W - 0.5, 0.09, 0.09, 0, 0.58, tailZ + 0.1)

  const unit = sprungUnit(frame, cab, 1, o.steer, lamps)
  bakeLamps(unit, tail)
  fitWheels(unit, o)
  for (const s of [-1, 1]) addFlaps(unit, M, s * (W / 2 - 0.44), 0.72, -0.78, 0.6)
  return {
    tractor: unit,
    trailer: null,
    wheelbase: o.steer,
    kingpin: 0,
    reach: 0,
    nose: nose + 0.16,
    tail: -tailZ,
    height: roof + 0.5,
    stacks,
    cargo: { unit: 'tractor', geo: bundleGeo(1, 0.36, 1.2), slots: grid(2, 3, 2, 1.04, 1.26, 0.38, bedY + 0.03, 1.2) },
  }
}

function rigPaint(color) {
  const m = matte(color, { roughness: 0.3, metalness: 0.2 })
  m.userData.k = 'paint'
  return m
}

function articulated(o, T, C, buildTrailer) {
  const paint = rigPaint(C.paint)
  const trim = matte(C.trim)
  const tractor = primeMover({ ...o, rim: C.rim }, paint, trim)
  const M = metal()
  const unit = sprungUnit(tractor.frame, tractor.cab, tractor.frameY, o.steer / 2, tractor.lamps)
  fitWheels(unit, { ...o, rim: C.rim })
  for (const s of [-1, 1]) addFlaps(unit, M, s * (o.track - o.tyre / 2), r2(o), Math.min(...o.drive) - o.r - 0.12, o.tyre * 2 + 0.1)

  const g = trailerFrame(T, paint, trim, M)
  const dress = buildTrailer(g.g, paint, trim, M)
  const trailer = new Group()
  trailer.add(bake(g.g, true, true))
  const axle = axleGeo(T.r, T.tyre, T.track, C.rim, true)
  for (const z of T.axles) addAxle(trailer, axle, T.r, z)
  for (const s of [-1, 1]) addFlaps(trailer, M, s * (T.track - T.tyre / 2), r2(T), Math.min(...T.axles) - T.r - 0.12, T.tyre * 2 + 0.1)
  bakeLamps(trailer, g.lamps)
  return {
    tractor: unit,
    trailer,
    wheelbase: o.steer,
    kingpin: o.kingpin,
    reach: T.reach,
    nose: tractor.nose + (o.bullBar ? 0.5 : 0.2),
    tail: T.reach - o.kingpin + T.tail,
    height: o.H + (o.sleeper || 0) + 0.5,
    stacks: tractor.stacks,
    cargo: { unit: 'trailer', ...dress },
  }
}
const r2 = (o) => o.r + 0.3

const BUILD = {
  starter,
  bigRig(C) {
    const o = { r: 0.66, tyre: 0.4, W: 2.8, track: 1.14, steer: 4.6, over: 1.1, hoodBack: 0.9, cabL: 2.1, H: 4, hoodY: 2.44, kingpin: 0.35, drive: [0.68, -0.68], tail: 0.7, tanks: 1.3, stacks: [1, -1], stackUp: 0.6 }
    const T = { r: 0.6, tyre: 0.38, track: 1.1, W: 2.74, reach: 3.9, front: 0.5, tail: 1.05, axles: [0.65, -0.65], deckY: 1.62 }
    return articulated(o, T, C, (g, paint, trim, M) => {
      deckBoards(g, T, M)
      headboard(g, T, paint, M, 1.5)
      stakes(g, T, M.steel, M, 6, 0.86, T.deckY)
      return { geo: bundleGeo(1.24, 0.44, 1.26), slots: grid(2, 4, 2, 1.28, 1.3, 0.46, T.deckY + 0.05, T.reach - 0.25) }
    })
  },
  logLoader(C) {
    const o = { r: 0.7, tyre: 0.44, W: 2.9, track: 1.2, steer: 5, over: 1.15, hoodBack: 0.95, cabL: 2.3, H: 4.2, hoodY: 2.56, kingpin: 0.4, drive: [0.72, -0.72], tail: 0.75, tanks: 1.5, stacks: [-1], stackUp: 0.5, headacheRack: true, sleeper: 0.25, lightBar: true }
    const T = { r: 0.64, tyre: 0.4, track: 1.14, W: 2.7, reach: 4.9, front: 0.45, tail: 1.05, axles: [0.65, -0.65], deckY: 1.7 }
    return articulated(o, T, C, (g, paint, trim, M) => {
      // Bunks and stanchions in place of a deck, and the loader crane folded on its pedestal.
      const steel = matte(C.trim, { metalness: 0.3, roughness: 0.45 })
      const bunks = [T.reach - 0.3, 2.3, 0.1, -T.tail + 0.25]
      for (const z of bunks) {
        box(g, M.dark, T.W, 0.2, 0.34, 0, T.deckY + 0.08, z)
        for (const s of [-1, 1]) {
          box(g, steel, 0.16, 2.1, 0.16, s * (T.W / 2 - 0.06), T.deckY + 1.15, z)
          bar(g, M.steel, 0.1, 0.05, s * (T.W / 2 - 0.06), T.deckY + 2.2, z, 'y', 8)
          box(g, M.steel, 0.3, 0.1, 0.22, s * (T.W / 2 - 0.1), T.deckY + 0.24, z)
        }
      }
      const craneZ = T.reach + T.front - 0.2
      const cy = T.deckY
      const yellow = matte(C.crane)
      bar(g, M.dark, 0.34, 0.5, 0, cy + 0.25, craneZ - 0.1, 'y', 14)
      bar(g, yellow, 0.24, 1.7, 0, cy + 1.2, craneZ - 0.1, 'y', 12)
      box(g, yellow, 0.34, 0.34, 3.1, 0.1, cy + 2.28, craneZ - 1.5, 0, -0.02)
      box(g, yellow, 0.26, 0.26, 2.6, -0.14, cy + 2.62, craneZ - 1.3)
      bar(g, M.chrome, 0.08, 1.8, 0.28, cy + 2.32, craneZ - 1.4, 'z', 8)
      bar(g, M.dark, 0.34, 0.5, 0, cy + 2.45, craneZ - 0.1, 'x', 12)
      bar(g, M.dark, 0.2, 0.6, -0.02, cy + 2.45, craneZ - 2.85, 'x', 10)
      box(g, M.steel, 0.5, 0.6, 0.4, -0.14, cy + 2.1, craneZ - 2.9) // the grapple, tucked up
      tube(g, M.black, [[0.14, cy + 1, craneZ + 0.06], [0.3, cy + 2.1, craneZ], [0.3, cy + 2.5, craneZ - 1.2]], 0.03)
      // Logs: long, stacked as a pyramid between the stanchions.
      const r = 0.25
      const len = T.reach + T.front + T.tail - 0.8
      const mid = (T.reach + T.front - T.tail) / 2 - 0.25
      const slots = []
      for (const [row, n] of [5, 4, 4, 3, 2].entries()) {
        for (let i = 0; i < n; i++) slots.push([(i - (n - 1) / 2) * (r * 2 + 0.02), T.deckY + 0.42 + row * (r * 1.85), mid])
      }
      return { geo: logGeo(r, len), slots }
    })
  },
  titan(C) {
    const o = { r: 0.78, tyre: 0.48, W: 3.2, track: 1.34, steer: 5.4, over: 1.25, hoodBack: 1, cabL: 2.9, H: 4.5, hoodY: 2.86, kingpin: 0.1, drive: [1.34, 0, -1.34], tail: 0.72, tanks: 1.6, stacks: [1, -1], stackUp: 0.3, sleeper: 0.62, bullBar: true, intakes: true, lightBar: true, skirt: true }
    const T = { r: 0.68, tyre: 0.44, track: 1.26, W: 3, reach: 5, front: 0.5, tail: 0.96, axles: [1.38, 0, -1.38], deckY: 1.82 }
    return articulated(o, T, C, (g, paint, trim, M) => {
      deckBoards(g, T, M)
      headboard(g, T, paint, M, 1.9)
      stakes(g, T, trim, M, 7, 1.34, T.deckY)
      for (const s of [-1, 1]) box(g, trim, 0.06, 0.1, T.reach + T.front + T.tail, s * (T.W / 2 - 0.03), T.deckY + 1.3, (T.reach + T.front - T.tail) / 2)
      return { geo: bundleGeo(1.34, 0.46, 1.4), slots: grid(2, 4, 3, 1.38, 1.44, 0.48, T.deckY + 0.05, T.reach - 0.3) }
    })
  },
}

// The neon OP Truck, on show by the bays until bought: the Big Rig's frame with a stake trailer.
BUILD.op = (C) => {
  const o = { r: 0.66, tyre: 0.4, W: 2.8, track: 1.14, steer: 4.6, over: 1.1, hoodBack: 0.9, cabL: 2.3, H: 4, hoodY: 2.44, kingpin: 0.35, drive: [0.68, -0.68], tail: 0.7, tanks: 1.3, stacks: [1, -1], stackUp: 0.7, sleeper: 0.4, neon: C.neon }
  const T = { r: 0.6, tyre: 0.38, track: 1.1, W: 2.74, reach: 3.9, front: 0.5, tail: 1.05, axles: [0.65, -0.65], deckY: 1.62 }
  return articulated(o, T, C, (g, paint, trim, M) => {
    const glow = neon(C.neon, 3)
    deckBoards(g, T, M)
    headboard(g, T, paint, M, 1.5)
    stakes(g, T, matte(C.stake), M, 6, 1.5, T.deckY)
    const len = T.reach + T.front + T.tail
    for (const s of [-1, 1]) box(g, glow, 0.06, 0.07, len, s * (T.W / 2 + 0.03), T.deckY - 0.06, (T.reach + T.front - T.tail) / 2)
    return { geo: bundleGeo(1.24, 0.44, 1.26), slots: grid(2, 4, 4, 1.28, 1.3, 0.46, T.deckY + 0.05, T.reach - 0.25) }
  })
}

const templates = new Map()
// The built truck of a GAME.trucks.levels entry, shared by every rig of that name.
export function rigTemplate(name) {
  let t = templates.get(name)
  if (!t) templates.set(name, (t = BUILD[name](YARD.rigs[name])))
  return t
}

// A whole truck standing still, centred on its length, for a place that doesn't drive it. Lamps out.
export function rigShowpiece(name) {
  const t = rigTemplate(name)
  const g = new Group()
  const mid = (t.nose - t.tail) / 2
  const add = (unit, z) => {
    const u = unit.clone(true)
    u.position.z = z - mid
    const lamps = []
    u.traverse((o) => o.name.startsWith('lamp-') && lamps.push(o))
    for (const o of lamps) o.removeFromParent()
    g.add(u)
  }
  add(t.tractor, 0)
  if (t.trailer) add(t.trailer, t.kingpin - t.reach)
  return g
}
