import { Group } from 'three'
import { YARD } from '../config.js'
import { solidBox } from '../propkit.js'
import { box, matte, picture, place } from './kit.js'
import { paintBanner } from './paint.js'

// The upper floors: steel decks on posts over the line, an L round its corner, railed in yellow,
// each with a stair up from the floor below. Each step is shallow enough to walk up.
const { floors: F, colors: C } = YARD
const steel = () => matte(C.navy)
const plate = () => matte('#4a5060')
const rail = () => matte(C.guardRail)

function railRun(g, colliders, [ax, az, bx, bz], y) {
  const len = Math.hypot(bx - ax, bz - az)
  const yaw = Math.atan2(bx - ax, bz - az)
  const cx = (ax + bx) / 2
  const cz = (az + bz) / 2
  box(g, rail(), 0.14, 0.14, len, cx, y + F.railHeight, cz, yaw)
  box(g, rail(), 0.1, 0.1, len, cx, y + F.railHeight / 2, cz, yaw)
  const posts = Math.max(1, Math.round(len / F.railEvery))
  for (let i = 0; i <= posts; i++) box(g, rail(), 0.12, F.railHeight, 0.12, ax + ((bx - ax) * i) / posts, y + F.railHeight / 2, az + ((bz - az) * i) / posts)
  colliders.push(solidBox(0.1, F.railHeight / 2, len / 2, cx, y + F.railHeight / 2, cz, yaw))
}

function stair(g, colliders, s, top) {
  const bottom = top - F.y
  const steps = Math.ceil(F.y / F.step)
  const w = s.east - s.west
  const x = (s.east + s.west) / 2
  for (let i = 0; i < steps; i++) {
    const h = top - i * F.step
    const z = s.top + s.dir * (i + 0.5) * F.run
    const thick = Math.min(h - bottom + 0.1, F.tread)
    box(g, steel(), w, thick, F.run, x, h - thick / 2, z)
    box(g, matte(i % 2 ? '#f2c21c' : C.navy), w, 0.04, F.run - 0.06, x, h + 0.01, z)
    colliders.push(solidBox(w / 2, thick / 2, F.run / 2, x, h - thick / 2, z))
  }
  const len = steps * F.run
  const tilt = Math.atan2(F.y, len)
  const slope = Math.hypot(F.y, len)
  for (const sx of [s.west, s.east]) box(g, rail(), 0.14, 0.14, slope, sx, (top + bottom) / 2 + 1, s.top + (s.dir * len) / 2, 0, s.dir * tilt)
}

function buildDeck(scene, plan, floor) {
  const y = F.y * floor
  const g = new Group()
  const colliders = []
  for (const r of plan.decks) {
    const w = r.east - r.west
    const d = r.south - r.north
    const cx = (r.east + r.west) / 2
    const cz = (r.north + r.south) / 2
    // No shadow: a whole deck's would black out everything under it.
    box(g, steel(), w + 0.2, 0.3, d + 0.2, cx, y - 0.16, cz).castShadow = false
    box(g, plate(), w, 0.04, d, cx, y - 0.01, cz).castShadow = false
    colliders.push(solidBox(w / 2, 0.15, d / 2, cx, y - 0.15, cz))
  }
  for (const [x, z] of F.posts) {
    box(g, steel(), 0.42, F.y, 0.42, x, y - F.y / 2, z)
    box(g, steel(), 1, 0.16, 1, x, y - F.y + 0.08, z)
    colliders.push(solidBox(0.22, F.y / 2, 0.22, x, y - F.y / 2, z))
  }
  for (const run of plan.rails) railRun(g, colliders, run, y)
  stair(g, colliders, plan.stair, y)
  if (plan.board) {
    const b = plan.board
    box(g, matte(C.woodDark), b.w + 0.2, b.h + 0.2, 0.2, b.x, y + b.lift + b.h / 2, b.z)
    for (const x of [-b.w * 0.3, b.w * 0.3]) box(g, matte(C.woodDark), 0.26, b.lift, 0.26, b.x + x, y + b.lift / 2, b.z)
    picture(g, paintBanner(b.text, { bg: '#7a5230', fill: '#ffd84a' }), b.w, b.h, b.x, y + b.lift + b.h / 2, b.z + 0.11)
  }
  const model = place(scene, g)
  model.visible = false
  for (const c of colliders) c.setEnabled(false)
  return {
    show(on) {
      model.visible = on
      for (const c of colliders) c.setEnabled(on)
    },
  }
}

export function buildFloors(scene) {
  const decks = F.plans.map((plan, i) => buildDeck(scene, plan, i + 1))
  return {
    // Floor 1 is the Second Floor, floor 2 the Third.
    show: (floor, on) => decks[floor - 1].show(on),
    reset() {
      for (const d of decks) d.show(false)
    },
  }
}
