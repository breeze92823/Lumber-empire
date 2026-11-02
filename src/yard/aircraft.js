import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, SRGBColorSpace, Sprite, SpriteMaterial } from 'three'
import * as sfx from '../audio/sfx.js'
import { shake } from '../camera.js'
import { AIR, GAME } from '../config.js'
import { bake } from '../bake.js'
import { neon } from '../propkit.js'
import { paintSoftDot } from '../textures.js'
import { bar, box, matte, picture } from './kit.js'
import { polyline } from './line.js'
import { paintAirMark, paintFinMark, paintLoadTag } from './paint.js'

// The freighters that fly the wood out, one model per Aircraft Level, and the one flight there is:
// stand > ramp up > taxi > line up > take-off roll > climb > away > approach > touchdown > roll out >
// back round the teardrop at the west end to the stand. They are working aircraft, not airliners:
// square holds, high wings, wheels in sponsons, a ramp that drops to the ground behind, and no glass
// anywhere but the flight deck. The Hangar sells the levels as the Depot sells trucks: a plane on the
// stand is swapped where it stands, one away comes back as the new model. Models are built nose to
// +Z, standing on y = 0. A load is paid as its wheels leave the ground.
const F = AIR.flight
const { stand: S, taxi: X, runway: R } = AIR
const EAST = Math.PI / 2
const WEST = -Math.PI / 2
const RAMP_DROP = 0.2 // rad the lowered ramp makes with the ground

function strip(geo) {
  for (const n of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(n)) geo.deleteAttribute(n)
  return geo
}

// The fuselage from nose to tail: [share of the length, of the half width, of the half height, height
// of the middle as a share of the half height]. Flat floored and square, swept up behind the hold.
const BODY = [[0.5, 0.02, 0.02, -0.3], [0.49, 0.26, 0.24, -0.27], [0.465, 0.5, 0.46, -0.2], [0.43, 0.72, 0.68, -0.1], [0.385, 0.9, 0.86, -0.03], [0.32, 1, 0.97, 0], [-0.1, 1, 1, 0], [-0.19, 0.98, 0.9, 0.1], [-0.29, 0.86, 0.68, 0.34], [-0.39, 0.62, 0.46, 0.6], [-0.46, 0.38, 0.3, 0.78], [-0.5, 0.12, 0.12, 0.9]]
const HINGE = -0.12 // share of the length: where the hold's floor meets the ramp

function bodyAt(t) {
  for (let i = 0; i + 1 < BODY.length; i++) {
    const [a, ...p] = BODY[i]
    const [b, ...q] = BODY[i + 1]
    if (t <= a && t >= b) {
      const k = (a - t) / (a - b)
      return p.map((v, j) => v + (q[j] - v) * k)
    }
  }
  return BODY.at(-1).slice(1)
}

// A tube along z through rounded rectangles: `rings` are [z, half width, half height, middle y],
// `box` how square they are, 2 being an ellipse. `paint(x, y, z, out)` colours a vertex.
function loft(rings, box, sides, paint) {
  const pos = []
  const col = []
  const c = new Color()
  const e = 2 / box
  for (const [z, w, h, y] of rings) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2
      const sx = Math.cos(a)
      const sy = Math.sin(a)
      const px = Math.sign(sx) * Math.abs(sx) ** e * w
      const py = y + Math.sign(sy) * Math.abs(sy) ** e * h
      pos.push(px, py, z)
      paint(px, py, z, c)
      col.push(c.r, c.g, c.b)
    }
  }
  const index = []
  for (let r = 0; r + 1 < rings.length; r++) {
    for (let i = 0; i < sides; i++) {
      const a = r * sides + i
      const b = r * sides + ((i + 1) % sides)
      const d = (r + 1) * sides + i
      const f = (r + 1) * sides + ((i + 1) % sides)
      index.push(a, d, b, b, d, f)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
}

const skin = () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.12, side: DoubleSide })

function buildHull(spec, cy) {
  const { len: L, w, h } = spec
  const belly = new Color(spec.belly)
  const paint = new Color(spec.paint)
  const stripe = new Color(spec.stripe)
  const nose = new Color('#1b1d24')
  const rings = []
  // Extra rings down the barrel keep the paint's edges straight.
  const ts = [...BODY.map((b) => b[0])]
  for (let t = 0.3; t > -0.48; t -= 0.05) ts.push(t)
  ts.sort((a, b) => b - a)
  for (const t of ts) {
    const [kw, kh, ky] = bodyAt(t)
    rings.push([t * L, kw * w, kh * h, ky * h])
  }
  const geo = loft(rings, spec.box, 36, (x, y, z, c) => {
    const k = y / h
    c.copy(z > L * 0.46 ? nose : k < -0.5 ? belly : k < -0.34 ? stripe : paint)
  })
  const m = new Mesh(geo, skin())
  m.position.y = cy
  return m
}

// A flying surface seen from above: `span` wide, swept back by `sweep`, `thick` deep at the root.
function buildWing(mat, span, root, tip, sweep, thick) {
  const s = new Shape()
  s.moveTo(-span / 2, tip / 2 - sweep)
  s.lineTo(0, root / 2)
  s.lineTo(span / 2, tip / 2 - sweep)
  s.lineTo(span / 2, -tip / 2 - sweep)
  s.lineTo(0, -root / 2)
  s.lineTo(-span / 2, -tip / 2 - sweep)
  s.closePath()
  return new Mesh(strip(new ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, thick / 2, 0)), mat)
}

function buildFin(mat, h, chord, back) {
  const s = new Shape()
  s.moveTo(-chord / 2, 0)
  s.lineTo(chord / 2, 0)
  s.lineTo(chord * 0.14 - back, h)
  s.lineTo(-chord * 0.42 - back, h)
  s.closePath()
  return new Mesh(strip(new ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1).rotateY(-Math.PI / 2)), mat)
}

// A streamlined pod along z, for nacelles, sponsons and flap fairings.
function buildPod(color, len, w, h, box_ = 2, y = 0) {
  const mat = new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.12, side: DoubleSide })
  const shape = [[0.5, 0.25], [0.44, 0.74], [0.3, 1], [-0.3, 1], [-0.44, 0.7], [-0.5, 0.18]]
  const geo = loft(shape.map(([t, k]) => [t * len, k * w, k * h, y]), box_, 14, (px, py, pz, c) => c.set('#ffffff'))
  geo.deleteAttribute('color')
  return new Mesh(geo, mat)
}

function wheel(g, x, y, z, r, w) {
  bar(g, matte('#15161c'), r, w, x, y, z, 'x', 16)
  bar(g, matte('#b9bec7'), r * 0.52, w + 0.05, x, y, z, 'x', 10)
  bar(g, matte('#2d3039'), r * 0.2, w + 0.1, x, y, z, 'x', 8)
}

// Scimitar blades on a hub, and the disc they blur into at speed.
function buildProp(radius, blades, tip) {
  const g = new Group()
  const blade = matte('#1c1e26')
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    box(g, blade, radius * 0.17, radius * 0.56, 0.08, s * radius * 0.3, c * radius * 0.3, 0, 0.3, 0, -a)
    box(g, blade, radius * 0.13, radius * 0.48, 0.07, s * radius * 0.74, c * radius * 0.74, 0, 0.3, 0, -a - 0.08)
    box(g, matte(tip), radius * 0.13, radius * 0.08, 0.08, s * radius * 0.97, c * radius * 0.97, 0, 0.3, 0, -a - 0.08)
  }
  const spun = bake(g, true, false)
  const disc = new Mesh(new CircleGeometry(radius, 28), new MeshBasicMaterial({ color: '#c6ccd8', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }))
  return { spun, disc }
}

function decal(g, map, w, h, x, y, z, ry) {
  const m = picture(g, map, w, h, x, y, z, ry)
  m.material.transparent = true
  m.material.depthWrite = false
  m.material.toneMapped = true
  return m
}

export function buildPlane(name) {
  const spec = AIR.planes[name]
  const { len: L, w, h, span, chord, gear, tyre } = spec
  const cy = gear + h // the middle of the fuselage above the ground
  const floorY = gear + h * 0.08
  const hingeZ = L * HINGE
  const rampLen = (floorY - 0.1) / Math.sin(RAMP_DROP)
  const lipZ = hingeZ - rampLen * Math.cos(RAMP_DROP)
  const root = new Group()
  const body = new Group()
  body.position.y = cy
  const paint = matte(spec.paint, { roughness: 0.46, metalness: 0.1 })
  const trim = matte(spec.trim, { roughness: 0.46, metalness: 0.1 })
  const steel = matte('#3a3f4b', { roughness: 0.5, metalness: 0.3 })
  const seam = matte('#16181e')
  const pale = matte('#d8dbe0', { roughness: 0.35, metalness: 0.5 })
  const glass = matte('#101a33', { roughness: 0.1, metalness: 0.6 })
  const wingY = h * 0.96
  const wingZ = L * 0.1
  const thick = w * 0.26

  // The hull, and over it the joins of its frames.
  root.add(buildHull(spec, cy))
  for (let t = 0.3; t > -0.44; t -= 0.075) {
    const [kw, kh, ky] = bodyAt(t)
    const geo = loft([[t * L - 0.03, kw * w * 1.004, kh * h * 1.004, ky * h], [t * L + 0.03, kw * w * 1.004, kh * h * 1.004, ky * h]], spec.box, 36, (x, y, z, c) => c.set('#ffffff'))
    geo.deleteAttribute('color')
    body.add(new Mesh(geo, seam))
  }

  // The wing carry-through on the roof, the wing, and what hangs under it.
  const hump = buildPod(spec.paint, chord[0] * 1.5, w * 0.72, h * 0.3, 3)
  hump.position.set(0, h * 0.94, wingZ)
  body.add(hump)
  const wing = buildWing(paint, span, chord[0], chord[1], spec.sweep, thick)
  wing.position.set(0, wingY + thick * 0.6, wingZ)
  body.add(wing)
  const inner = chord[0] * 0.5
  for (const side of [-1, 1]) {
    // The dark line of the flaps, the steel leading edge and the coloured tip.
    box(body, seam, span * 0.46, 0.03, chord[1] * 0.08, (side * span) / 4, wingY + thick * 1.11, wingZ - inner * 0.42 - spec.sweep * 0.5)
    box(body, pale, span * 0.46, thick * 0.3, chord[1] * 0.1, (side * span) / 4, wingY + thick * 0.6, wingZ + chord[0] * 0.36 - spec.sweep * 0.46, side * Math.atan2(spec.sweep * 2 + chord[0] - chord[1], span))
    box(body, trim, 0.5, thick * 0.5, chord[1] * 0.98, (side * (span - 0.5)) / 2, wingY + thick * 0.6, wingZ - spec.sweep)
    for (const k of [0.3, 0.56, 0.8]) {
      const canoe = buildPod('#8f949c', chord[0] * 0.8, 0.16, 0.2)
      const x = (side * k * span) / 2
      canoe.position.set(x, wingY + 0.02, wingZ - spec.sweep * k - chord[0] * 0.18)
      body.add(canoe)
    }
    if (spec.winglet) {
      const up = buildFin(trim, chord[1] * 0.9, chord[1] * 0.8, chord[1] * 0.26)
      up.position.set((side * span) / 2, wingY + thick, wingZ - spec.sweep)
      up.rotation.z = -side * 0.2
      body.add(up)
    }
    // The strut of a little wing.
    if (spec.fixed) box(body, steel, 0.14, Math.hypot(span * 0.22, h * 1.3), 0.34, side * (w + span * 0.1), wingY - h * 0.66, wingZ, 0, 0, side * 1.0)
  }

  // Tail, by type.
  const tailT = -0.455
  const [tw, , ty] = bodyAt(tailT)
  const tailZ = tailT * L
  const tailY = ty * h
  const fin = (x, tall, c, back) => {
    const f = buildFin(trim, tall, c, back)
    f.position.set(x, tailY + h * 0.2, tailZ)
    body.add(f)
    return f
  }
  const stab = (y, sp, c, backBy) => {
    const t = buildWing(paint, sp, c, c * 0.55, backBy, 0.22 + L * 0.006)
    t.position.set(0, y, tailZ)
    body.add(t)
  }
  if (spec.tail === 'twin') {
    stab(tailY + h * 0.44, span * 0.34, chord[0] * 0.56, 0.1)
    for (const side of [-1, 1]) {
      const f = fin((side * span * 0.34) / 2, h * 1.6, chord[0] * 0.6, 0.1)
      f.position.y = tailY - h * 0.1
    }
  } else {
    const tall = spec.tail === 'T' ? h * 2.05 : h * 2.4
    const back = chord[0] * 0.28
    fin(0, tall, chord[0] * 0.92, back)
    // The fin's root runs forward along the roof.
    box(body, trim, 0.24, h * 0.42, chord[0] * 1.5, 0, tailY + h * 0.2, tailZ + chord[0] * 0.5, 0, 0.32)
    if (spec.tail === 'T') {
      const y = tailY + h * 0.2 + tall
      stab(y, span * 0.42, chord[0] * 0.68, chord[0] * 0.3)
      const bullet = buildPod(spec.paint, chord[0] * 0.9, 0.42, 0.42)
      bullet.position.set(0, y + 0.1, tailZ - back - chord[0] * 0.12)
      body.add(bullet)
    } else {
      stab(tailY + h * 0.46, span * 0.4, chord[0] * 0.62, chord[0] * 0.2)
    }
  }
  box(body, steel, 0.5, 0.34, 0.5, 0, tailY + h * 0.04, tailZ - L * 0.02) // the APU's tail cone

  // The flight deck: the only glass on the aircraft.
  const deckZ = L * 0.405
  const [dw, dh, dy] = bodyAt(0.405)
  const deckY = dy * h + dh * h * 0.62
  box(body, glass, dw * w * 1.5, h * 0.3, 0.12, 0, deckY, deckZ + L * 0.016, 0, -0.7)
  box(body, seam, 0.1, h * 0.32, 0.14, 0, deckY, deckZ + L * 0.018, 0, -0.7)
  for (const side of [-1, 1]) {
    box(body, glass, 0.1, h * 0.26, L * 0.05, side * dw * w * 1.02, deckY - h * 0.02, deckZ - L * 0.022, side * 0.34)
    box(body, glass, 0.1, h * 0.2, L * 0.022, side * w * 1.002, deckY - h * 0.02, deckZ - L * 0.065)
    // The crew door, and a stencilled mark for the ground crew.
    box(body, seam, 0.04, h * 1.04, h * 0.05, side * w * 1.004, -h * 0.05, L * 0.285)
    box(body, seam, 0.04, h * 1.04, h * 0.05, side * w * 1.004, -h * 0.05, L * 0.245)
    box(body, seam, 0.04, h * 0.05, L * 0.04, side * w * 1.004, h * 0.46, L * 0.265)
    box(body, seam, 0.04, h * 0.05, L * 0.04, side * w * 1.004, -h * 0.56, L * 0.265)
    // The side cargo door's outline.
    box(body, seam, 0.04, h * 1.2, h * 0.05, side * w * 1.004, -h * 0.05, -L * 0.04)
    box(body, seam, 0.04, h * 1.2, h * 0.05, side * w * 1.004, -h * 0.05, -L * 0.08 - h * 0.9)
    box(body, seam, 0.04, h * 0.05, h * 0.9 + L * 0.04, side * w * 1.004, h * 0.55, -L * 0.06 - h * 0.45)
  }
  for (const z of [-0.2, 0.05]) box(body, steel, 0.06, h * 0.26, 0.2, 0, h * 1.08, L * z, 0, 0.35) // aerials
  for (const side of [-1, 1]) box(body, pale, 0.05, 0.05, L * 0.03, side * dw * w * 0.8, dy * h - h * 0.12, L * 0.46)

  const lettering = paintAirMark('LUMBER AIR CARGO', spec.stripe === '#f4f5f7' ? '#ffffff' : spec.trim, 'rgba(0,0,0,0.35)')
  for (const side of [-1, 1]) decal(body, lettering, L * 0.42, L * 0.07, side * (w + 0.03), h * 0.42, L * 0.03, (side * Math.PI) / 2)
  const pine = paintFinMark('#ffffff')
  if (spec.tail !== 'twin') {
    const tall = spec.tail === 'T' ? h * 2.05 : h * 2.4
    for (const side of [-1, 1]) decal(body, pine, h * 1.15, h * 1.15, side * 0.13, tailY + h * 0.2 + tall * 0.55, tailZ - chord[0] * 0.2, (side * Math.PI) / 2)
  }

  // The hold seen from behind: dark, ribbed, with its lights on. The ramp shuts over it.
  const rearT = (hingeZ - rampLen * 0.98) / L
  const [, , backY] = bodyAt(rearT)
  const [, backH] = bodyAt(rearT)
  const openW = w * 1.42
  const openDrop = -h + 0.02
  const backBottom = (backY - backH) * h
  const openLen = Math.hypot(rampLen * 0.98, backBottom - openDrop)
  const openPitch = Math.atan2(backBottom - openDrop, rampLen * 0.98)
  const hold = new Group()
  hold.position.set(0, openDrop + cy - 0.02, hingeZ)
  hold.rotation.x = openPitch
  box(hold, seam, openW, 0.04, openLen, 0, -0.02, -openLen / 2)
  for (let i = 1; i < 5; i++) box(hold, matte('#2d3039'), openW, 0.06, 0.1, 0, -0.05, (-openLen * i) / 5)
  box(hold, neon('#ffe9b0', 2.8), openW * 0.8, 0.05, 0.14, 0, -0.08, -openLen * 0.2)
  box(hold, neon('#ffe9b0', 2.8), openW * 0.8, 0.05, 0.14, 0, -0.08, -openLen * 0.7)
  body.add(hold)
  hold.position.y -= cy

  const ramp = new Group()
  box(ramp, paint, openW * 0.98, 0.14, rampLen, 0, -0.08, -rampLen / 2)
  box(ramp, matte('#5e6470', { roughness: 0.6 }), openW * 0.86, 0.04, rampLen * 0.97, 0, 0.0, -rampLen / 2)
  for (const x of [-openW * 0.3, -openW * 0.1, openW * 0.1, openW * 0.3]) box(ramp, matte('#8f949c', { roughness: 0.4, metalness: 0.4 }), 0.1, 0.1, rampLen * 0.95, x, 0.05, -rampLen / 2) // roller tracks
  for (const side of [-1, 1]) {
    box(ramp, matte('#f2c21c'), 0.12, 0.2, rampLen, side * openW * 0.46, 0.08, -rampLen / 2)
    box(ramp, seam, 0.2, 0.18, 0.5, side * openW * 0.38, -0.02, -rampLen * 0.98) // its toes
  }
  const rampBaked = bake(ramp, true, false)
  rampBaked.position.set(0, floorY, hingeZ)
  rampBaked.rotation.x = openPitch
  root.add(rampBaked)
  const shutPitch = openPitch

  // Engines.
  const pods = []
  const flames = []
  const props = []
  for (const E of spec.engines) {
    const { x } = E
    const k = Math.abs(x) / (span / 2)
    if (E.type === 'jet') {
      const y = wingY - E.r * 1.28
      const z = wingZ - spec.sweep * k + chord[0] * 0.24
      box(body, paint, 0.34, E.r * 0.9, E.len * 0.56, x, wingY - E.r * 0.3, z - E.len * 0.04, 0, 0.1) // the pylon
      const pod = buildPod(spec.paint, E.len, E.r, E.r)
      pod.position.set(x, y, z)
      body.add(pod)
      bar(body, pale, E.r * 0.97, E.len * 0.1, x, y, z + E.len * 0.46, 'z', 20) // the lip
      bar(body, trim, E.r * 1.02, E.len * 0.13, x, y, z + E.len * 0.26, 'z', 20)
      bar(body, matte('#12141b'), E.r * 0.84, 0.16, x, y, z + E.len * 0.5, 'z', 20) // the fan
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        box(body, matte('#5e6470', { metalness: 0.5, roughness: 0.35 }), E.r * 0.1, E.r * 0.72, 0.05, x + Math.sin(a) * E.r * 0.42, y + Math.cos(a) * E.r * 0.42, z + E.len * 0.51, 0.3, 0, -a)
      }
      const nose = new Mesh(new ConeGeometry(E.r * 0.24, E.r * 0.6, 12).rotateX(Math.PI / 2), pale)
      nose.position.set(x, y, z + E.len * 0.56)
      body.add(nose)
      bar(body, matte('#23252e', { metalness: 0.4 }), E.r * 0.62, E.len * 0.2, x, y, z - E.len * 0.52, 'z', 16) // the core
      bar(body, matte('#0d0e13'), E.r * 0.46, 0.1, x, y, z - E.len * 0.62, 'z', 14)
      const flame = new Mesh(new ConeGeometry(E.r * 0.42, E.len * 0.6, 12).rotateX(-Math.PI / 2).translate(0, 0, -E.len * 0.3), neon('#6fb7ff', 2.6, { transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false }))
      flame.position.set(x, y + cy, z - E.len * 0.63)
      flames.push(flame)
      pods.push({ x, y: y + cy, z: z - E.len * 0.5, jet: true })
    } else {
      const y = wingY - 0.1
      const z = wingZ - spec.sweep * k + chord[0] * 0.55
      const nacelle = E.r * 2
      const pod = buildPod(spec.paint, nacelle, E.r * 0.32, E.r * 0.4, 2.6)
      pod.position.set(x, y, z - nacelle * 0.3)
      body.add(pod)
      box(body, seam, E.r * 0.3, E.r * 0.12, E.r * 0.3, x, y - E.r * 0.38, z + nacelle * 0.1) // chin intake
      bar(body, steel, E.r * 0.08, E.r * 0.5, x + E.r * 0.2 * Math.sign(x), y + E.r * 0.14, z - nacelle * 0.65, 'z', 8) // exhaust stub
      box(body, trim, E.r * 0.66, 0.05, E.r * 0.16, x, y + E.r * 0.38, z + nacelle * 0.06)
      const spinner = new Mesh(new ConeGeometry(E.r * 0.2, E.r * 0.5, 14).rotateX(Math.PI / 2), matte(spec.trim))
      spinner.position.set(x, y, z + nacelle * 0.26)
      body.add(spinner)
      const { spun, disc } = buildProp(E.r, E.blades, spec.trim)
      for (const part of [spun, disc]) {
        part.position.set(x, y + cy, z + nacelle * 0.17)
        root.add(part)
      }
      props.push({ spun, disc })
      pods.push({ x, y: y + cy, z, jet: false })
    }
  }

  // The undercarriage. A mule's stands in the wind on big soft tyres; the rest fold into sponsons.
  const legs = new Group()
  const strut = matte('#6b7180', { metalness: 0.4, roughness: 0.4 })
  const sz = -L * 0.02
  const sponsonLen = tyre * 3.2 * spec.bogies + 1
  for (const side of [-1, 1]) {
    const x = side * (w + tyre * 0.3)
    if (!spec.fixed) {
      const sponson = buildPod(spec.paint, sponsonLen, tyre * 0.82, h * 0.34, 3)
      sponson.position.set(side * (w + tyre * 0.3), -h + h * 0.26, sz)
      body.add(sponson)
    }
    for (let i = 0; i < spec.bogies; i++) {
      const z = sz + (i - (spec.bogies - 1) / 2) * tyre * 2.5
      wheel(legs, x, tyre, z, tyre, tyre * 0.72)
      box(legs, strut, 0.16, gear, 0.16, x - side * tyre * 0.5, tyre + gear * 0.3, z)
    }
    if (spec.fixed) box(legs, strut, 0.2, Math.hypot(w * 0.8, gear), 0.3, side * (w * 0.62), gear * 0.72, sz, 0, 0, side * 0.9)
  }
  const nz = L * 0.33
  box(legs, strut, 0.2, gear + 0.6, 0.2, 0, gear * 0.62, nz)
  for (const side of [-1, 1]) wheel(legs, side * tyre * 0.48, tyre * 0.72, nz, tyre * 0.72, tyre * 0.46)

  const hull = bake(body, true, true)
  hull.position.y = cy
  const undercarriage = bake(legs, true, false)
  root.add(hull, undercarriage, ...flames)

  // Red on the left, green on the right, a beacon on the roof, a strobe on the tail and a lamp ahead.
  const dot = (mat, x, y, z, s = 0.24) => {
    const m = new Mesh(new CircleGeometry(s, 10), mat)
    m.position.set(x, y, z)
    m.rotation.y = x > 0 ? Math.PI / 2 : x < 0 ? -Math.PI / 2 : 0
    root.add(m)
    return m
  }
  const tipY = cy + wingY + thick * 0.6
  dot(neon('#ff3030', 4, { side: DoubleSide }), span / 2 + 0.03, tipY, wingZ - spec.sweep)
  dot(neon('#2bff6a', 4, { side: DoubleSide }), -span / 2 - 0.03, tipY, wingZ - spec.sweep)
  const beacon = new Mesh(new CylinderGeometry(0.16, 0.2, 0.26, 10), neon('#ff2a2a', 5))
  beacon.position.set(0, cy + h * 1.18, -L * 0.12)
  root.add(beacon)
  const strobe = dot(neon('#ffffff', 6, { side: DoubleSide }), 0, cy + tailY + h * 0.2, tailZ - chord[0] * 0.5, 0.22)
  return { name, spec, root, ramp: rampBaked, openAngle: -RAMP_DROP, shutAngle: shutPitch, floorY, hingeZ, lipZ, pods, props, flames, legs: undercarriage, beacon, strobe, nose: L / 2 + 0.2, lampY: cy - h * 0.3, topY: cy + h + wingY }
}

function arc(pts, cx, cz, r, from, to, n = 16) {
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n
    pts.push([cx + r * Math.sin(a), 0, cz + r * Math.cos(a)])
  }
}

// Stand to the hold line at the head of the take-off run.
export function routeOut(stopX) {
  const { turn, east, hold } = X
  const pts = [[stopX, 0, S.z], [east, 0, S.z]]
  arc(pts, east, S.z + turn, turn, Math.PI, EAST)
  arc(pts, hold, S.z + turn, turn, WEST, 0)
  return polyline(pts)
}

// Touchdown, down the runway, round the teardrop and onto the stand.
export function routeBack(stopX) {
  const { turn, back } = X
  const pts = [[F.down, 0, R.z], [back, 0, R.z]]
  arc(pts, back, S.z + turn, turn, 0, -Math.PI)
  pts.push([stopX, 0, S.z])
  const way = polyline(pts)
  way.bend = F.down - back // m along it that the turn starts
  way.bendEnd = way.bend + Math.PI * turn
  return way
}

export function createPlanes(scene, { items, bursts, stats, trucks }) {
  const level = () => GAME.aircraft[stats.aircraft]
  const models = new Map()
  const spot = { at: null, yaw: 0 }
  const dotTex = new CanvasTexture(paintSoftDot())
  dotTex.colorSpace = SRGBColorSpace
  const lamp = new Sprite(new SpriteMaterial({ map: dotTex, color: '#fff3d0', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false }))
  lamp.scale.setScalar(7)
  lamp.visible = false
  scene.add(lamp)

  function model(name) {
    let m = models.get(name)
    if (!m) {
      m = buildPlane(name)
      const stopX = S.lip - m.lipZ
      m.stopX = stopX
      m.out = routeOut(stopX)
      m.back = routeBack(stopX)
      m.root.visible = false
      m.root.rotation.order = 'YXZ'
      scene.add(m.root)
      models.set(name, m)
    }
    return m
  }
  for (const { plane } of GAME.aircraft) model(plane)

  const p = {
    m: null,
    state: 'none',
    x: 0, y: 0, z: 0, yaw: EAST, pitch: 0, roll: 0, v: 0,
    throttle: 0,
    s: 0,
    load: 0,
    worth: 0,
    wait: 0, // s of patience left, once the first item is on
    left: 0, // s of this state left
    ramp: 0, // 0 up .. 1 down
    gear: 1, // 0 up .. 1 down
    pop: 0,
    dustLeft: 0,
    full: false,
  }
  let player = null

  const tagTex = paintLoadTag(() => `${p.load}/${level().items}`)
  const tag = new Sprite(new SpriteMaterial({ map: tagTex, transparent: true, depthWrite: false, fog: false }))
  tag.scale.set(8, 1.5, 1)
  tag.visible = false
  scene.add(tag)

  function show(name) {
    if (p.m?.name === name) return
    if (p.m) p.m.root.visible = false
    p.m = model(name)
    p.m.root.visible = true
  }

  function setRampNow(k) {
    p.ramp = k
    const m = p.m
    m.ramp.rotation.x = m.shutAngle + (m.openAngle - m.shutAngle) * k
  }

  function park() {
    p.x = p.m.stopX
    p.y = 0
    p.z = S.z
    p.yaw = EAST
    p.pitch = p.roll = p.v = 0
    p.gear = 1
    p.state = 'stand'
    p.throttle = 0
    tag.visible = true
    tagTex.userData.paint()
  }

  // Heard from the sound layer: what is running and how hard. `size` 0 for the smallest, 1 the biggest.
  const voice = { on: false, jet: false, x: 0, y: 0, z: 0, throttle: 0, size: 0 }
  const sizeOf = () => GAME.aircraft.findIndex((l) => l.plane === p.m.name) / (GAME.aircraft.length - 1)

  function wheelSmoke(n) {
    const yaw = p.yaw
    const { spec } = p.m
    const heavy = 0.8 + spec.len / 30
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1
      const off = side * (spec.w + 0.4)
      bursts.dust.spawn({ x: p.x - Math.cos(yaw) * off * (Math.random() * 0.4 + 0.8), y: 0.4, z: p.z + Math.sin(yaw) * off, vx: Math.sin(yaw) * p.v * 0.4 + (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2.4, vz: Math.cos(yaw) * p.v * 0.4 + (Math.random() - 0.5) * 3, life: 0.9 + Math.random() * 1.2, size: (0.9 + Math.random() * 0.7) * heavy, grow: 4, color: i % 3 ? '#cfcac0' : '#a9a49a', opacity: 0.75, gravity: -0.6, drag: 1.6 })
    }
  }

  // Where a point of the model stands now, near enough: yaw only.
  const world = (mx, my, mz, to) => {
    const s = Math.sin(p.yaw)
    const c = Math.cos(p.yaw)
    to.x = p.x + s * mz + c * mx
    to.y = p.y + my + Math.sin(p.pitch) * mz
    to.z = p.z + c * mz - s * mx
    return to
  }
  const at = { x: 0, y: 0, z: 0 }

  // The wash behind the engines, and whatever the ground gives up to it.
  function wash(dt) {
    p.dustLeft -= dt
    if (p.dustLeft > 0) return
    p.dustLeft = p.m.pods[0].jet ? 0.03 : 0.045
    const hx = Math.sin(p.yaw)
    const hz = Math.cos(p.yaw)
    for (const pod of p.m.pods) {
      world(pod.x, pod.y, pod.z, at)
      if (p.y < 14 && p.throttle > 0.5) {
        const k = 1 - p.y / 14
        bursts.dust.spawn({ x: at.x - hx * 3, y: 0.5, z: at.z - hz * 3, vx: -hx * 18 * p.throttle + (Math.random() - 0.5) * 3.5, vy: 0.8 + Math.random() * 1.8, vz: -hz * 18 * p.throttle + (Math.random() - 0.5) * 3.5, life: 1.1 + Math.random(), size: 1.3, grow: 3.4, color: at.z > R.z - R.half ? '#8c8a84' : '#b7b4aa', opacity: 0.42 * k, drag: 1.5 })
      }
      if (pod.jet && p.throttle > 0.3) {
        bursts.flames.spawn({ x: at.x - hx * 3, y: at.y, z: at.z - hz * 3, vx: -hx * 24, vy: (Math.random() - 0.5) * 1.5, vz: -hz * 24, life: 0.3 + Math.random() * 0.25, size: 0.7, grow: 2.4, color: Math.random() < 0.5 ? '#6fb7ff' : '#ffb266', opacity: 0.5 * p.throttle })
        if (p.y > 26) bursts.dust.spawn({ x: at.x - hx * 4, y: at.y, z: at.z - hz * 4, life: 2.4, size: 0.7, grow: 3.2, color: '#ffffff', opacity: 0.5, drag: 0.6 })
      } else if (!pod.jet && p.throttle > 0.6 && p.y < 2) {
        bursts.dust.spawn({ x: at.x, y: at.y, z: at.z, vx: -hx * 12, vz: -hz * 12, life: 0.5, size: 0.8, grow: 3, color: '#d8d4c8', opacity: 0.16 })
      }
    }
  }

  function moveRamp(dt, open) {
    const was = p.ramp
    setRampNow(Math.max(0, Math.min(1, p.ramp + (open ? dt : -dt) / F.ramp)))
    if (was === (open ? 0 : 1) && p.ramp !== was) sfx.ramp(p.x, S.z, open, voice.size)
    if (p.ramp === (open ? 1 : 0) && was !== p.ramp) sfx.rampHome(p.x + p.m.lipZ, S.z, open, voice.size)
  }

  function steer(way, target, dt) {
    if (p.v < target) p.v = Math.min(target, p.v + F.accel * 0.6 * dt)
    else p.v = Math.max(target, p.v - F.rollBrake * dt)
    p.s = Math.min(way.length, p.s + p.v * dt)
    way.at(p.s, spot)
    p.x = spot.at[0]
    p.z = spot.at[2]
    const turn = Math.atan2(Math.sin(spot.yaw - p.yaw), Math.cos(spot.yaw - p.yaw))
    p.yaw += turn * Math.min(1, dt * 6)
    p.roll += (turn * -0.3 - p.roll) * Math.min(1, dt * 4)
  }

  // Stops for the player on the way, and nothing else: there is only one plane.
  function clearAhead() {
    if (!player || player.y < -1) return true
    const dx = player.x - p.x
    const dz = player.z - p.z
    const ahead = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)
    const across = Math.abs(dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw))
    return !(ahead > 0 && ahead < p.m.nose + F.stopFor && across < p.m.spec.w + 2.4)
  }

  const STATES = {
    none() {},
    stand(dt) {
      p.throttle += (0 - p.throttle) * Math.min(1, dt * 1.6)
      moveRamp(dt, true)
      if (!p.load) return
      p.wait -= dt
      if (p.wait <= 0 || p.load >= level().items) out.send()
    },
    shut(dt) {
      moveRamp(dt, false)
      p.left -= dt
      p.throttle += (0.22 - p.throttle) * Math.min(1, dt * 2)
      if (p.left <= 0) {
        p.state = 'taxiOut'
        p.s = 0
        sfx.radio(p.x, p.z)
      }
    },
    taxiOut(dt) {
      p.throttle += (0.34 - p.throttle) * Math.min(1, dt * 2)
      const rem = p.m.out.length - p.s
      steer(p.m.out, clearAhead() ? Math.min(F.taxi, Math.sqrt(2 * F.brake * rem) + 0.4) : 0, dt)
      if (rem < 0.1) {
        p.state = 'hold'
        p.left = F.spool
        p.v = 0
        p.yaw = EAST
        sfx.spool(p.x, p.z, voice.jet, voice.size)
      }
    },
    hold(dt) {
      p.left -= dt
      p.throttle += (1 - p.throttle) * Math.min(1, dt * 2.6)
      p.pitch = -0.012 // the brakes hold it and the nose dips
      wash(dt)
      if (p.left <= 0) p.state = 'roll'
    },
    roll(dt) {
      p.v += F.accel * dt
      p.x += p.v * dt
      p.pitch += ((p.v > F.rotate - 6 ? 0.13 : 0) - p.pitch) * Math.min(1, dt * 3)
      p.roll *= 0.9
      wash(dt)
      if (Math.random() < 0.6) wheelSmoke(1)
      if (p.v >= F.rotate) {
        p.state = 'climb'
        out.onFlight?.({ value: Math.round(p.worth * (1 + (p.full ? level().bonus : 0) / 100)), count: p.load, name: level().name, full: p.full })
        for (let i = 0; i < 46; i++) bursts.flames.spawn({ x: p.x + (Math.random() - 0.5) * p.m.spec.len, y: 3 + Math.random() * 3, z: p.z + (Math.random() - 0.5) * 7, vx: p.v * 0.7, vy: 1 + Math.random() * 5, vz: (Math.random() - 0.5) * 3, life: 1 + Math.random(), size: 0.4, color: i % 2 ? '#ffd84a' : '#fff0a8', gravity: 3 })
        p.load = 0
        p.worth = 0
        sfx.cashOut()
      }
    },
    climb(dt) {
      p.v = Math.min(F.rotate * 2.2, p.v + F.accel * 0.6 * dt)
      if (!p.m.spec.fixed) p.gear = Math.max(0, p.gear - dt * (p.y > 2 ? 1.2 : 0))
      if (p.gear <= 0 && !p.gearUp) {
        p.gearUp = true
        sfx.gear(p.x, p.z)
      }
      p.pitch += (F.climb - p.pitch) * Math.min(1, dt * 1.2)
      p.yaw += dt * 0.05 // leaning away to the north as it climbs
      p.roll += (-0.18 - p.roll) * Math.min(1, dt * 0.8)
      const up = Math.sin(p.pitch)
      p.x += Math.sin(p.yaw) * p.v * dt
      p.z += Math.cos(p.yaw) * p.v * dt
      p.y += up * p.v * dt
      wash(dt)
      if (p.y > F.top || p.x > F.away) {
        p.state = 'away'
        p.m.root.visible = false
        p.left = stats.flightTime
        p.gearUp = false
      }
    },
    away(dt) {
      p.left -= dt
      if (p.left <= 0) out.callIn()
    },
    approach(dt) {
      const t = (p.x - F.down) / (F.from - F.down)
      p.v = F.flare + (F.approach - F.flare) * Math.min(1, t * 3)
      p.x -= p.v * dt
      p.y = F.height * Math.max(0, t) ** 1.25
      p.pitch += ((t < 0.05 ? 0.12 : 0.02) - p.pitch) * Math.min(1, dt * 2)
      p.throttle += ((t < 0.05 ? 0.12 : 0.45) - p.throttle) * Math.min(1, dt * 2)
      p.gear = t < 0.7 || p.m.spec.fixed ? Math.min(1, p.gear + dt) : 0
      if (t < 0.7 && !p.gearDown) {
        p.gearDown = true
        sfx.gear(p.x, p.z)
      }
      wash(dt)
      if (p.x <= F.down) {
        p.y = 0
        p.state = 'rollout'
        p.s = 0
        p.gearDown = false
        p.reversed = false
        wheelSmoke(30)
        for (let i = 0; i < 28; i++) bursts.flames.spawn({ x: p.x, y: 0.3, z: p.z + (i % 2 ? 1 : -1) * p.m.spec.w, vx: -p.v * 0.6 + Math.random() * 8, vy: 1 + Math.random() * 5, vz: (Math.random() - 0.5) * 8, life: 0.3 + Math.random() * 0.4, size: 0.26, color: '#ffc05a', gravity: 16 })
        sfx.touchdown(p.x, p.z, voice.size)
        const near = 1 - Math.min(1, Math.hypot(player?.x - p.x, player?.z - p.z) / 160)
        if (near > 0) shake((0.25 + voice.size * 0.3) * near)
      }
    },
    rollout(dt) {
      const way = p.m.back
      const rem = way.length - p.s
      p.pitch += (0 - p.pitch) * Math.min(1, dt * 2.4)
      const slowing = p.v > F.taxiBack
      // The reversers throw it on, then it trundles home.
      p.throttle += ((slowing ? 0.9 : 0.34) - p.throttle) * Math.min(1, dt * 3)
      if (p.s > 12 && !p.reversed) {
        p.reversed = true
        sfx.reverse(p.x, p.z, voice.jet, voice.size)
      }
      const bend = p.s < way.bend ? Math.max(0, way.bend - p.s) : 0
      let target = Math.min(F.taxiBack, Math.sqrt(2 * F.brake * bend) + F.turnSpeed)
      if (p.s >= way.bend) target = F.turnSpeed
      if (p.s >= way.bendEnd) target = Math.min(F.turnSpeed, Math.sqrt(2 * F.brake * rem) + 0.3)
      if (!slowing && !clearAhead()) target = 0
      steer(way, target, dt)
      if (slowing) {
        wash(dt)
        if (Math.random() < 0.35) wheelSmoke(1)
      }
      if (rem < 0.1) {
        out.dock()
        out.onDocked?.()
      }
    },
  }

  const out = {
    onFlight: null,
    onDocked: null,
    voice,
    get state() {
      return p.state
    },
    get m() {
      return p.m
    },
    get load() {
      return p.load
    },
    get left() {
      return p.left
    },
    // Taking cargo now: ramp down, room inside.
    get accepting() {
      return p.state === 'stand' && p.ramp >= 0.95 && p.load < level().items
    },
    get room() {
      return level().items - p.load
    },
    // The ramp: where its end rests on the ground and where it meets the hold's floor.
    get ramp() {
      if (!p.m) return null
      return { lip: [p.x + p.m.lipZ, 0.22, S.z], hinge: [p.x + p.m.hingeZ, p.m.floorY + 0.1, S.z] }
    },
    // On the stand, or about to be on it: the boom may reach out.
    get parked() {
      return p.state === 'stand' && p.ramp > 0.6
    },
    get taxiing() {
      return p.state === 'rollout' && p.v <= F.taxiBack + 1
    },
    // An item comes aboard and is paid for at wheels up: more than a truck pays, and at least AIR.log.
    take(item) {
      p.worth += Math.max(GAME.products[item.kind].value * AIR.premium, AIR.log) * item.mult * trucks.cash
      p.wait = AIR.patience // idle timeout: a plane that is still being fed keeps waiting
      p.load++
      tagTex.userData.paint()
    },
    // Shuts up and goes, full or out of patience.
    send() {
      if (p.state !== 'stand') return
      p.full = p.load >= level().items
      p.state = 'shut'
      p.left = F.ramp + F.settle
      tag.visible = false
    },
    // Back from wherever it has been, as the current level's plane.
    callIn() {
      show(level().plane)
      p.m.root.visible = true
      p.state = 'approach'
      p.x = F.from
      p.y = F.height
      p.z = R.z
      p.yaw = WEST
      p.roll = 0
      p.pitch = 0.02
      p.v = F.approach
      p.gear = p.m.spec.fixed ? 1 : 0
      setRampNow(0)
      voice.size = sizeOf()
      out.refresh()
    },
    dock() {
      show(level().plane)
      voice.size = sizeOf()
      park()
    },
    // Puts one on the stand at once: a loaded save.
    placeNow() {
      show(level().plane)
      p.m.root.visible = true
      p.load = 0
      p.worth = 0
      voice.size = sizeOf()
      park()
      setRampNow(1)
      out.refresh()
    },
    refresh() {
      tagTex.userData.paint()
    },
    // An Aircraft Level was bought: one on the stand turns into the new model where it stands.
    refit() {
      const want = level().plane
      out.refresh()
      if (p.state !== 'stand' || p.m?.name === want) return false
      show(want)
      voice.size = sizeOf()
      park()
      setRampNow(1)
      p.pop = 1
      items.burst(p.x, 4, p.z, 70)
      for (let i = 0; i < 40; i++) bursts.flames.spawn({ x: p.x + (Math.random() - 0.5) * p.m.spec.len, y: 2 + Math.random() * 4, z: p.z + (Math.random() - 0.5) * 8, vy: 2 + Math.random() * 6, vx: (Math.random() - 0.5) * 6, vz: (Math.random() - 0.5) * 6, life: 0.9 + Math.random() * 0.8, size: 0.4, color: i % 2 ? '#25e3ff' : '#ffffff', gravity: 3 })
      return true
    },
    reset() {
      if (p.m) {
        p.m.root.visible = false
        setRampNow(0)
      }
      p.m = null
      p.state = 'none'
      p.load = 0
      p.worth = 0
      p.pop = 0
      p.gearUp = p.gearDown = false
      tag.visible = false
      lamp.visible = false
      voice.on = false
    },
    update(dt, elapsed, you, night) {
      player = you
      STATES[p.state](dt)
      const { m } = p
      if (!m || p.state === 'none' || p.state === 'away') {
        voice.on = false
        lamp.visible = false
        return
      }
      p.pop = Math.max(0, p.pop - dt * 2.2)
      const k = 1 + Math.sin(p.pop * Math.PI) * 0.1
      m.root.scale.setScalar(k)
      m.root.position.set(p.x, p.y + Math.sin(elapsed * 22) * 0.012 * p.throttle * (p.y < 0.1 ? 1 : 0), p.z)
      m.root.rotation.set(-p.pitch, p.yaw, p.roll)
      m.legs.visible = p.gear > 0.02
      m.legs.scale.y = 0.4 + p.gear * 0.6
      m.legs.position.y = (1 - p.gear) * m.spec.gear * 0.7
      const spin = 2 + p.throttle * 62
      for (const { spun, disc } of m.props) {
        spun.rotation.z += spin * dt
        spun.visible = p.throttle < 0.5
        disc.material.opacity = Math.min(0.42, p.throttle * 0.7)
      }
      for (const f of m.flames) {
        f.visible = p.throttle > 0.05
        f.scale.set(0.8 + p.throttle * 0.4, 0.8 + p.throttle * 0.4, 0.3 + p.throttle * (1.4 + Math.random() * 0.4))
      }
      const blink = (elapsed * 1.1) % 1
      m.beacon.visible = p.state !== 'stand' && blink < 0.16
      m.strobe.visible = p.state !== 'stand' && ((blink + 0.5) % 1) < 0.08
      const lit = p.state === 'approach' || p.state === 'roll' || p.state === 'rollout' || p.state === 'climb'
      lamp.visible = lit
      if (lit) {
        world(0, m.lampY, m.nose * 1.02, lamp.position)
        lamp.scale.setScalar(night ? 13 : 5)
        lamp.material.opacity = night ? 1 : 0.85
      }
      tag.position.set(p.x, m.topY + 2, p.z)
      voice.on = p.state !== 'stand' || p.throttle > 0.02
      voice.jet = m.pods[0].jet
      voice.x = p.x
      voice.y = p.y
      voice.z = p.z
      voice.throttle = p.throttle
    },
  }
  return out
}
