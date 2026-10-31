import { BoxGeometry, BufferAttribute, Color, CylinderGeometry, InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GAME } from '../config.js'
import { mulberry32 } from '../textures.js'

// Everything that moves down the chain, drawn in one place: logs on the grass, in hands, on
// belts and on pallets are all instances of one mesh per product, re-listed every frame between
// begin() and end(). An item is plain data: { kind, mult, tint, rainbow }. Also the airborne ones
// (a hop from hands to a belt) and the wood chips of an axe blow.
const CAP = 180
const WHITE = new Color('#ffffff')

function piece(geo, color) {
  const flat = geo.index ? geo.toNonIndexed() : geo
  flat.deleteAttribute('uv')
  const c = new Color(color)
  const n = flat.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3)
  flat.setAttribute('color', new BufferAttribute(colors, 3))
  return flat
}
const slab = (w, h, d, y, color) => piece(new BoxGeometry(w, h, d).translate(0, y, 0), color)
const round = (r, len, z, color, sides = 12) => piece(new CylinderGeometry(r, r, len, sides).rotateX(Math.PI / 2).translate(0, 0, z), color)

// Each lies along +Z, centred on its own middle. `half` is its height above the belt.
const MODELS = {
  log: {
    half: 0.42,
    across: 3,
    wide: 0.86,
    parts: () => [round(0.42, 2.8, 0, '#a8733f'), round(0.38, 0.03, 1.41, '#e6cda3'), round(0.38, 0.03, -1.41, '#e6cda3'), round(0.14, 0.05, 1.42, '#9a6c3e', 8), round(0.14, 0.05, -1.42, '#9a6c3e', 8)],
  },
  debarked: {
    half: 0.4,
    across: 3,
    wide: 0.84,
    parts: () => [round(0.4, 2.8, 0, '#ecd5a8'), round(0.36, 0.03, 1.41, '#f3e2bd'), round(0.36, 0.03, -1.41, '#f3e2bd'), round(0.13, 0.05, 1.42, '#c9a26c', 8), round(0.13, 0.05, -1.42, '#c9a26c', 8)],
  },
  plank: {
    half: 0.15,
    across: 2,
    wide: 1.3,
    parts: () => [slab(1.2, 0.24, 2.7, 0.02, '#e8d3ab'), slab(1.22, 0.04, 2.72, -0.1, '#cfb384')],
  },
  dried: {
    half: 0.15,
    across: 2,
    wide: 1.3,
    parts: () => [slab(1.2, 0.24, 2.7, 0.02, '#b67a45'), slab(1.22, 0.04, 2.72, -0.1, '#8f5a30')],
  },
  bundle: {
    half: 0.42,
    across: 2,
    wide: 1.4,
    parts: () => [
      slab(1.3, 0.26, 2.7, -0.28, '#b67a45'),
      slab(1.3, 0.26, 2.7, 0, '#a86c3a'),
      slab(1.3, 0.26, 2.7, 0.28, '#bf8450'),
      slab(1.36, 0.88, 0.14, 0, '#23252e').translate(0, 0, 0.8), // the straps
      slab(1.36, 0.88, 0.14, 0, '#23252e').translate(0, 0, -0.8),
    ],
  },
  chair: {
    half: 0.62,
    across: 2,
    wide: 1.4,
    parts: () => [
      slab(1.15, 0.14, 1.15, 0.02, '#b98a55'),
      slab(1.15, 1, 0.14, 0.52, '#a87a48').translate(0, 0, -0.5),
      ...[[-0.46, -0.46], [0.46, -0.46], [-0.46, 0.46], [0.46, 0.46]].map(([x, z]) => slab(0.14, 0.58, 0.14, -0.33, '#8f6638').translate(x, 0, z)),
    ],
  },
  table: {
    half: 0.52,
    across: 2,
    wide: 2.2,
    parts: () => [
      slab(2, 0.16, 2.8, 0.44, '#c49a66'),
      ...[[-0.8, -1.2], [0.8, -1.2], [-0.8, 1.2], [0.8, 1.2]].map(([x, z]) => slab(0.18, 0.82, 0.18, -0.05, '#9a7144').translate(x, 0, z)),
    ],
  },
  bed: {
    half: 0.5,
    across: 1,
    wide: 2.4,
    parts: () => [
      slab(2.2, 0.36, 3.3, -0.3, '#7a4a28'),
      slab(2.04, 0.34, 3.14, 0.04, '#f3f1ea'),
      slab(2.06, 0.1, 2.2, 0.2, '#d62f35').translate(0, 0, 0.46),
      slab(1.5, 0.2, 0.6, 0.3, '#ffffff').translate(0, 0, -1.2),
      slab(2.3, 1.3, 0.2, 0.15, '#5e3820').translate(0, 0, -1.7),
      slab(2.3, 0.8, 0.2, -0.1, '#5e3820').translate(0, 0, 1.7),
    ],
  },
}

// An item as one number, for the wire: its product and which of the few looks it wears.
const KINDS = Object.keys(MODELS)
const GOLD = GAME.trees.find((t) => t.id === 'golden').color
const LOOKS = [{}, { tint: GOLD }, { tint: GAME.haunt.log }, { rainbow: true }]
const lookOf = (item) => (item.rainbow ? 3 : item.tint === GOLD ? 1 : item.tint ? 2 : 0)
export const isItemKind = (kind) => KINDS.includes(kind)
export const itemCode = (item) => KINDS.indexOf(item.kind) * 4 + lookOf(item)
export function itemFrom(code) {
  const kind = KINDS[Math.floor(code / 4)]
  return kind ? { kind, mult: 1, tint: null, rainbow: false, ...LOOKS[code % 4] } : null
}

export function createItems(scene) {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 })
  const dummy = new Object3D()
  const color = new Color()
  const meshes = {}
  for (const [kind, spec] of Object.entries(MODELS)) {
    const mesh = new InstancedMesh(mergeGeometries(spec.parts()), mat, CAP)
    mesh.castShadow = mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.setColorAt(0, WHITE)
    mesh.count = 0
    scene.add(mesh)
    meshes[kind] = mesh
  }

  // Wood chips: a small ring of little boxes thrown from a trunk.
  const { chips: C } = GAME
  const chipMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#c9975c', roughness: 0.8 }), C.count)
  chipMesh.frustumCulled = false
  chipMesh.count = 0
  scene.add(chipMesh)
  const chips = Array.from({ length: C.count }, () => ({ age: C.life, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }))
  let chipAt = 0
  const rand = mulberry32(41)

  const flying = []
  let time = 0

  function add(item, x, y, z, yaw = 0, scale = 1, spin = 0) {
    const mesh = meshes[item.kind]
    if (mesh.count >= CAP) return
    dummy.position.set(x, y, z)
    dummy.rotation.set(spin, yaw, 0, 'YXZ') // spin tips it about its own width: a belt's slope, or a tumble
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(mesh.count, dummy.matrix)
    if (item.rainbow) color.setHSL((time * GAME.rainbowSpeed) % 1, 0.9, 0.72)
    else color.set(item.tint ?? WHITE)
    mesh.setColorAt(mesh.count, color)
    mesh.count++
  }

  const out = {
    meshes: [...Object.values(meshes), chipMesh],
    add,
    onLand: null, // (item, where): anything thrown has arrived
    // How high an item stands when its bottom is at floor y.
    rest: (item) => MODELS[item.kind].half,
    // Item i of a pile on a floor at y: laid side by side across x, then layer on layer.
    stack(item, i, x, y, z, yaw = 0, scale = 1) {
      const M = MODELS[item.kind]
      const row = i % M.across
      const layer = Math.floor(i / M.across)
      const dx = (row - (M.across - 1) / 2) * M.wide * scale
      add(item, x + dx * Math.cos(yaw), y + M.half * scale * (1 + layer * 2), z - dx * Math.sin(yaw), yaw, scale)
    },
    // A hop from one spot to another; `land` runs when it arrives. `to` may move.
    fly(item, from, to, time = 0.4, land = null) {
      flying.push({ item, ax: from.x, ay: from.y, az: from.z, to, t: 0, time, land })
    },
    get airborne() {
      return flying.length
    },
    // Everything in the air is simply gone: a rebirth.
    clear() {
      flying.length = 0
    },
    burst(x, y, z, n = C.perHit) {
      for (let i = 0; i < n; i++) {
        const c = chips[chipAt]
        chipAt = (chipAt + 1) % chips.length
        c.age = 0
        c.x = x
        c.y = y
        c.z = z
        c.vx = (rand() - 0.5) * 8
        c.vy = 3 + rand() * 5
        c.vz = (rand() - 0.5) * 8
      }
    },
    begin() {
      for (const m of Object.values(meshes)) m.count = 0
    },
    end(dt) {
      time += dt
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i]
        f.t += dt / f.time
        if (f.t >= 1) {
          flying.splice(i, 1)
          f.land?.(f.item)
          out.onLand?.(f.item, f.to)
          continue
        }
        const hop = 4 * f.t * (1 - f.t)
        add(f.item, f.ax + (f.to.x - f.ax) * f.t, f.ay + (f.to.y - f.ay) * f.t + hop * 1.3, f.az + (f.to.z - f.az) * f.t, f.t * 2, 0.85, f.t * 3)
      }
      for (const m of Object.values(meshes)) {
        m.visible = m.count > 0
        if (!m.count) continue
        m.instanceMatrix.needsUpdate = true
        m.instanceColor.needsUpdate = true
      }
      let n = 0
      for (const c of chips) {
        if (c.age >= C.life) continue
        c.age += dt
        c.vy -= C.gravity * dt
        c.x += c.vx * dt
        c.y = Math.max(0.05, c.y + c.vy * dt)
        c.z += c.vz * dt
        dummy.position.set(c.x, c.y, c.z)
        dummy.rotation.set(c.age * 9, c.age * 7, 0)
        dummy.scale.setScalar(C.size * (1 - c.age / C.life))
        dummy.updateMatrix()
        chipMesh.setMatrixAt(n++, dummy.matrix)
      }
      chipMesh.count = n
      chipMesh.visible = n > 0
      if (n) chipMesh.instanceMatrix.needsUpdate = true
    },
  }
  return out
}
