import { CircleGeometry, Group, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial } from 'three'
import { SHOP, YARD } from '../config.js'
import { shortMoney } from '../hud.js'
import { label, neon, solidBox, solidPole } from '../propkit.js'
import { bar, box, matte, picture, place, silhouette } from './kit.js'
import { paintAlert, paintBanner, paintHackerRing, paintLock, paintRingBase, paintRingRotor, paintShopTag } from './paint.js'

// The places the player walks up to: the Workers stall, the Trucks kiosk, the
// Hacker, the floor rings, plus the floating alerts, locks and tags.
const { colors: C } = YARD
const GROUND = new CircleGeometry(1, 48).rotateX(-Math.PI / 2)

function flatDecal(map, r, x, y, z) {
  const m = new Mesh(GROUND, new MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }))
  m.position.set(x, y, z)
  m.scale.set(r, 1, r)
  m.renderOrder = 1
  return m
}

// A striped market stall: crate counter, canopy, sign on top.
function buildStall() {
  const g = new Group()
  const W = 4.4
  const D = 2.6
  const wood = matte(C.wood)
  const dark = matte(C.woodDark)
  const cream = matte('#e8d4a8')

  // Crate counter of vertical slats.
  const slats = 11
  for (let i = 0; i < slats; i++) {
    const m = i % 2 ? wood : matte('#a56c3c')
    box(g, m, W / slats - 0.03, 1.3, 0.14, -W / 2 + (W / slats) * (i + 0.5), 0.65, D / 2)
  }
  box(g, dark, W + 0.2, 0.14, 0.2, 0, 0.1, D / 2 + 0.04)
  box(g, dark, W + 0.2, 0.14, 0.2, 0, 1.22, D / 2 + 0.04)
  box(g, wood, W, 1.3, D, 0, 0.64, 0)
  box(g, matte('#8d5a33'), W + 0.34, 0.2, D + 0.3, 0, 1.4, 0.06)
  // Back wall + uprights.
  box(g, cream, W, 2.4, 0.16, 0, 2.7, -D / 2 + 0.1)
  for (const x of [-W / 2, W / 2]) {
    box(g, dark, 0.2, 3.5, 0.2, x, 3.1, D / 2 - 0.2)
    box(g, dark, 0.2, 3.5, 0.2, x, 3.1, -D / 2 + 0.2)
  }
  // Striped canopy, sloping down to the front, with a scalloped valance.
  const stripes = 7
  const orange = matte('#eda028')
  const white = matte('#f6f2e8')
  const slope = 0.34
  for (let i = 0; i < stripes; i++) {
    const x = -W / 2 - 0.2 + ((W + 0.4) / stripes) * (i + 0.5)
    const w = (W + 0.4) / stripes
    const m = i % 2 ? white : orange
    box(g, m, w + 0.01, 0.14, D + 0.5, x, 4.42, 0.25, 0, slope)
    box(g, m, w + 0.01, 0.46, 0.08, x, 3.88, 1.58)
  }
  // Sign board.
  box(g, dark, 4.1, 1.1, 0.22, 0, 5.4, -0.4)
  for (const x of [-1.4, 1.4]) box(g, dark, 0.16, 0.8, 0.16, x, 4.7, -0.5)
  picture(g, paintBanner(YARD.stall.title, { bg: '#a87b2c', edge: '#4b3112', fill: '#ffdf4e' }), 3.9, 0.94, 0, 5.4, -0.28)
  return g
}

// The truck kiosk: a low pad with a fuel pump, barrels, tyre, tool box and cone,
// under a TRUCKS banner on two posts.
function buildKiosk() {
  const g = new Group()
  box(g, matte('#d9dbe0'), 7.2, 0.12, 2.8, 0, 0.06, 0)

  const pump = new Group()
  const red = matte('#ac2a2f')
  box(pump, red, 1.15, 2.2, 0.9, 0, 1.26, 0)
  box(pump, matte('#f0ece4'), 1.25, 0.4, 1, 0, 2.5, 0)
  box(pump, matte('#7c2428'), 1.2, 0.12, 0.95, 0, 2.2, 0)
  box(pump, matte('#23252e'), 1.3, 0.24, 1, 0, 0.24, 0)
  const screen = box(pump, neon('#39e1f5', 1.2), 0.72, 0.42, 0.04, 0, 1.75, 0.47)
  screen.castShadow = false
  box(pump, matte('#30343f'), 0.9, 0.1, 0.05, 0, 1.2, 0.46)
  g.add(pump)
  pump.position.set(-1.9, 0, 0.1)

  const blue = matte('#2f5fd0')
  bar(g, blue, 0.46, 1.3, -3, 0.77, 0.2, 'y', 14)
  for (const y of [0.45, 1.05]) bar(g, matte('#2349a8'), 0.48, 0.08, -3, y, 0.2, 'y', 14)

  bar(g, matte('#1a1c24'), 0.5, 1.7, 0.1, 0.97, -0.1, 'y', 14) // black drum
  bar(g, matte('#30333d'), 0.52, 0.08, 0.1, 1.82, -0.1, 'y', 14)

  // Tyre on its side against a post.
  bar(g, matte('#15161c'), 0.72, 0.5, 1.1, 0.74, 0.2, 'z', 18)
  bar(g, matte('#b9bec7'), 0.34, 0.54, 1.1, 0.74, 0.2, 'z', 12)
  bar(g, matte('#2d3039'), 0.14, 0.58, 1.1, 0.74, 0.2, 'z', 8)

  box(g, matte('#b6242c'), 1, 0.44, 0.62, -0.75, 0.34, 0.75)
  box(g, matte('#1b1c23'), 0.54, 0.12, 0.2, -0.75, 0.62, 0.75)

  const cone = matte('#ec6a1c')
  box(g, matte('#ec6a1c'), 0.62, 0.08, 0.62, 2.1, 0.16, 0.5)
  bar(g, cone, 0.16, 0.7, 2.1, 0.52, 0.5, 'y', 8)
  box(g, matte('#f6f2e8'), 0.34, 0.1, 0.34, 2.1, 0.5, 0.5)

  const post = matte('#2d3a55')
  box(g, post, 0.18, 4.1, 0.18, -2.1, 2.15, -0.7)
  box(g, post, 0.18, 4.1, 0.18, 1.3, 2.15, -0.7)
  box(g, matte('#6a5420'), 4.5, 1.2, 0.16, -0.4, 4.6, -0.7)
  picture(g, paintBanner(YARD.kiosk.title), 4.4, 1.1, -0.4, 4.6, -0.6)
  return g
}

// The Hacker: a figure and a desk of screens, drawn through silhouette() until bought.
function buildHackerFigure() {
  const g = new Group()
  const mat = matte('#16301f')
  box(g, mat, 0.72, 1, 0.42, 0, 1.45, 0)
  box(g, matte('#3dff9a'), 0.54, 0.54, 0.54, 0, 2.2, 0)
  box(g, mat, 0.3, 0.95, 0.34, -0.2, 0.48, 0)
  box(g, mat, 0.3, 0.95, 0.34, 0.2, 0.48, 0)
  box(g, mat, 0.24, 1, 0.3, -0.5, 1.45, 0)
  box(g, mat, 0.24, 1, 0.3, 0.5, 1.45, 0)
  return g
}
function buildHackerDesk() {
  const g = new Group()
  const mat = matte('#1a1d22')
  box(g, mat, 5, 0.3, 1.6, 0, 1.3, 0)
  box(g, mat, 0.3, 1.2, 1.4, -2.2, 0.6, 0)
  box(g, mat, 0.3, 1.2, 1.4, 2.2, 0.6, 0)
  box(g, mat, 3.2, 2.4, 0.3, 0, 2.9, -0.3)
  box(g, matte('#3dff9a'), 2.9, 2.1, 0.04, 0, 2.9, -0.14)
  const edge = matte('#010101') // its own material: it alone stays grey as a silhouette
  edge.userData.silhouette = '#c9c9c9'
  box(g, edge, 1.5, 0.12, 0.6, -1.2, 1.5, 0.4)
  return g
}

function buildRings(scene, remote) {
  const rotors = []
  for (const R of YARD.rings) {
    if (remote && R.own) continue
    const y = R.y ?? 0
    const base = flatDecal(paintRingBase(R.color, R.text, R.dark), R.r, R.x, y + 0.03, R.z)
    base.rotation.y = R.yaw
    const rotor = flatDecal(paintRingRotor(R.color), R.r, R.x, y + 0.04, R.z)
    rotor.renderOrder = 2
    scene.add(base, rotor)
    rotors.push({ spec: R, base, rotor, r: R.r, phase: R.x * 0.7 })
  }
  return rotors
}

function iconSprite(map, height, aspect = 1) {
  const s = new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false }))
  s.scale.set(height * aspect, height, 1)
  return s
}

export function buildStations(scene, remote = false) {
  const { stall: S, kiosk: K, hacker: H, opTruck: P, locked } = YARD

  place(scene, buildStall(), S.x, S.z)
  solidBox(2.3, 1.5, 1.4, S.x, 1.5, S.z)
  place(scene, buildKiosk(), K.x, K.z)
  solidBox(3.6, 1.5, 1.2, K.x, 1.5, K.z)

  // Hacker.
  scene.add(flatDecal(paintHackerRing(), H.ringRadius, H.x, 0.03, H.z + 0.6))
  const hackerShapes = [
    silhouette(scene, buildHackerFigure(), H.x, H.z + 0.6),
    silhouette(scene, buildHackerDesk(), H.x + 1.2, H.z - 1.7),
  ]
  const hackerReal = [place(scene, buildHackerFigure(), H.x, H.z + 0.6), place(scene, buildHackerDesk(), H.x + 1.2, H.z - 1.7)]
  for (const model of hackerReal) model.visible = false
  solidPole(0.5, 2, H.x, H.z + 0.6)
  const hackerTag = iconSprite(paintShopTag({ title: H.title, sub: H.sub, price: shortMoney(SHOP.hacker.money), titleColor: '#3dff9a', outline: '#0a3a24' }), 2, 760 / 300)
  hackerTag.position.set(H.x, 4.2, H.z + 0.6)
  scene.add(hackerTag)

  // Overhead tags.
  const opTag = iconSprite(paintShopTag({ title: P.title, sub: P.sub, price: shortMoney(SHOP.opTruck.money), titleColor: '#b56cff', outline: '#2a1163' }), 2.6, 760 / 300)
  opTag.position.set(P.x + 0.8, 5.6, P.z + 1.2)

  scene.add(opTag)

  // Locked items: a padlock with the rebirth it needs.
  const lockMap = paintLock()
  const locks = new Map()
  for (const L of locked) {
    if (remote && L.own) continue
    const lock = iconSprite(lockMap, L.lock, 256 / 320)
    lock.position.set(L.x, L.lockY, L.z)
    const need = label(L.label, L.text, { color: '#f3ead2', outline: '#16130c', outlineWidth: 18 })
    need.position.set(L.x, L.labelY, L.z)
    scene.add(lock, need)
    locks.set(L.label, [...(locks.get(L.label) ?? []), lock, need])
  }

  const alertMap = paintAlert()
  const alerts = YARD.alerts.map((a) => {
    const s = iconSprite(alertMap, 1.7)
    s.position.set(a.x, a.y, a.z)
    s.visible = false
    scene.add(s)
    return { sprite: s, y: a.y }
  })

  const rotors = buildRings(scene, remote)
  return {
    // The Hacker or OP Truck was bought (`id`, its ring's `perk`): its ring and price go.
    sold(id, on = true) {
      const ring = rotors.find((r) => r.spec.perk === id)
      ring.base.visible = ring.rotor.visible = !on
      if (id === 'opTruck') opTag.visible = !on
      if (id !== 'hacker') return
      hackerTag.visible = !on
      for (const model of hackerShapes) model.visible = !on
      for (const model of hackerReal) model.visible = on
    },
    // Takes the padlock and its label off every slot that needs this rebirth.
    unlock(text, on = true) {
      for (const sprite of locks.get(text) ?? []) sprite.visible = !on
    },
    // Shows alert `i` (an index of YARD.alerts: Trucks kiosk, Workers stall) while something there can be bought.
    setAlert(i, on) {
      alerts[i].sprite.visible = on
    },
    // Turns the ring for `spec` (an entry of YARD.rings) on or off.
    showRing(spec, on) {
      const ring = rotors.find((r) => r.spec === spec)
      if (ring) ring.base.visible = ring.rotor.visible = on
    },
    update(dt, elapsed) {
      for (const { rotor, r, phase } of rotors) {
        rotor.rotation.y -= dt * 0.9
        const k = r * (1 + Math.sin(elapsed * 2.4 + phase) * 0.025)
        rotor.scale.set(k, 1, k)
      }
      alerts.forEach((a, i) => {
        a.sprite.position.y = a.y + Math.sin(elapsed * 2.2 + i) * 0.16
      })
    },
  }
}
