import { BackSide, BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import { YARD } from '../config.js'
import { bake } from '../bake.js'

// Shorthands for the yard's hand-built models. Everything is unit primitives
// scaled into place, so a model is a tree of small meshes that bake() then
// merges to one mesh per material.
const UNIT_BOX = new BoxGeometry(1, 1, 1)
const UNIT_PLANE = new PlaneGeometry(1, 1)
const cylinders = new Map()

const mats = new Map()
// Matte plastic, the reference's surface. One material per colour.
export function matte(color, extra) {
  if (extra) return new MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, ...extra })
  let m = mats.get(color)
  if (!m) mats.set(color, (m = new MeshStandardMaterial({ color, roughness: 0.72, metalness: 0 })))
  return m
}
export const unlit = (color) => new MeshBasicMaterial({ color })

// w, h, d = full size; ry/rx/rz = rotation in radians.
export function box(parent, mat, w, h, d, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  const m = new Mesh(UNIT_BOX, mat)
  m.scale.set(w, h, d)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  parent.add(m)
  return m
}

// A round bar along Y. `axis` 'x' or 'z' lays it down along that axis.
export function bar(parent, mat, radius, length, x = 0, y = 0, z = 0, axis = 'y', sides = 14) {
  let geo = cylinders.get(sides)
  if (!geo) cylinders.set(sides, (geo = new CylinderGeometry(1, 1, 1, sides)))
  const m = new Mesh(geo, mat)
  m.scale.set(radius, length, radius)
  m.position.set(x, y, z)
  if (axis === 'x') m.rotation.z = Math.PI / 2
  if (axis === 'z') m.rotation.x = Math.PI / 2
  parent.add(m)
  return m
}

// A flat picture: faces +Z unless turned, unlit like the reference's screen-style signs.
export function picture(parent, map, w, h, x = 0, y = 0, z = 0, ry = 0) {
  const m = new Mesh(UNIT_PLANE, new MeshBasicMaterial({ map, toneMapped: false }))
  m.scale.set(w, h, 1)
  m.position.set(x, y, z)
  m.rotation.y = ry
  parent.add(m)
  return m
}

// One step of a bouncy spring, for UI that overshoots and settles. s = { k, v }.
export function spring(s, target, dt) {
  const h = Math.min(dt, 1 / 30)
  s.v += ((target - s.k) * YARD.buttons.stiffness - s.v * YARD.buttons.damping) * h
  s.k += s.v * h
}

// Bakes a model and sets it down at (x, z), turned to `yaw`.
export function place(scene, model, x = 0, z = 0, yaw = 0, y = 0, scale = 1) {
  const out = bake(model, true, true)
  out.position.set(x, y, z)
  out.rotation.y = yaw
  out.scale.setScalar(scale)
  scene.add(out)
  return out
}

// --- Locked items -------------------------------------------------------------
// The reference shows anything not yet unlocked as a flat black shape with a
// hair-thin grey rim, and its rails picked out in grey. A model turns into one
// here: every material goes black unless it set userData.silhouette, and a second
// back-face hull pushed out along the normals draws the rim.
const black = new MeshBasicMaterial({ color: YARD.colors.black, fog: false })
const rim = new MeshBasicMaterial({ color: YARD.colors.silhouetteRim, side: BackSide, fog: false })
rim.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * 0.035;')
}
const hints = new Map()

export function silhouette(scene, model, x = 0, z = 0, yaw = 0, scale = 1) {
  const out = bake(model, true, false)
  const shell = new Group()
  for (const mesh of [...out.children]) {
    const tint = mesh.material.userData?.silhouette
    if (tint) {
      let m = hints.get(tint)
      if (!m) hints.set(tint, (m = new MeshBasicMaterial({ color: new Color(tint), fog: false })))
      mesh.material = m
    } else {
      mesh.material = black
    }
    const hull = new Mesh(mesh.geometry, rim)
    shell.add(hull)
  }
  out.add(shell)
  out.position.set(x, 0, z)
  out.rotation.y = yaw
  out.scale.setScalar(scale)
  scene.add(out)
  return out
}
