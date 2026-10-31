import { Group } from 'three'
import { YARD } from '../config.js'
import { solidBox } from '../propkit.js'
import { career, upgradeCost } from '../stats.js'
import { leaders } from './leaders.js'
import { box, matte, picture, place, spring } from './kit.js'
import { paintLeaderPanel, paintPerkPanel, paintSaleSign, paintUpgradeBoard, upgradeButtons, paintPriceTag } from './paint.js'

// Every sign in the yard. The faces are unlit canvases (the reference's boards stay
// bright even though the sun is behind them); the frames are chunky lit timber.
const { colors: C, buttons: F } = YARD

// Timber frame around a face: side posts down to the floor, beams, a backing sheet.
function frame(g, w, h, lift, wood, { post = 0.46, depth = 0.34, backing = C.woodDark } = {}) {
  const top = lift + h
  const mat = matte(wood)
  box(g, mat, post, top + 0.46, depth * 1.3, -w / 2 - post / 2 + 0.06, (top + 0.46) / 2, 0)
  box(g, mat, post, top + 0.46, depth * 1.3, w / 2 + post / 2 - 0.06, (top + 0.46) / 2, 0)
  box(g, mat, w + 0.3, 0.32, depth, 0, top + 0.12, 0)
  box(g, mat, w + 0.3, 0.32, depth, 0, lift - 0.12, 0)
  box(g, matte(backing), w, h, depth * 0.6, 0, lift + h / 2, -0.03)
  // Stub feet under the bottom beam.
  for (const x of [-w * 0.25, w * 0.25]) box(g, mat, 0.34, lift - 0.2, 0.3, x, (lift - 0.2) / 2, 0)
}

function upgradeBoard(scene, spec) {
  const g = new Group()
  frame(g, spec.w, spec.h, spec.lift, C.woodDark, { backing: '#111725' })
  const face = paintUpgradeBoard(spec)
  picture(g, face, spec.w, spec.h, 0, spec.lift + spec.h / 2, 0.17)
  place(scene, g, spec.x, spec.z)
  solidBox(spec.w / 2 + 0.5, 2, 0.3, spec.x, 2, spec.z)
  return face
}

// A wooden sign holding colour panels stacked one above the other.
function panelSign(scene, spec, panelW, panelH, lift, bracket, reg) {
  const g = new Group()
  const top = lift + panelH * spec.panels.length
  const wood = matte(C.woodDark)
  for (const x of [-panelW / 2 - 0.15, panelW / 2 + 0.15]) box(g, wood, 0.34, top + 0.3, 0.3, x, (top + 0.3) / 2, 0)
  box(g, wood, panelW + 0.5, 0.26, 0.3, 0, top + 0.12, 0)
  box(g, wood, panelW + 0.5, 0.26, 0.3, 0, lift - 0.1, 0)
  box(g, matte('#101522'), panelW, top - lift, 0.14, 0, lift + (top - lift) / 2, -0.02)
  const defs = []
  spec.panels.forEach((panel, i) => {
    const y = top - panelH * (i + 0.5)
    defs.push({ cx: 0, cy: y, w: panelW - 0.14, h: panelH - 0.14, color: panel.colors[0], tex: paintPerkPanel(panel) })
    if (i) box(g, wood, panelW + 0.14, 0.14, 0.26, 0, y + panelH / 2, 0)
  })
  if (bracket) {
    const steel = matte('#191d29')
    for (let i = 0; i <= spec.panels.length; i++) {
      for (const x of [-panelW / 2 - 0.15, panelW / 2 + 0.15]) box(g, steel, 0.42, 0.2, 0.42, x, lift + panelH * i, 0)
    }
  }
  reg.add(spec, 0.12, defs)
  place(scene, g, spec.x, spec.z, spec.yaw)
  solidBox(panelW / 2 + 0.3, 1.5, 0.3, spec.x, 1.5, spec.z, spec.yaw)
}

// The south-west corner board: thick timber end posts with raked braces, a panel per stat and
// a stub of post under each divider. Returns the update that counts play time and repaints a
// panel when the player's number on it has changed.
function leaderboard(scene) {
  const B = YARD.leaderboard
  const g = new Group()
  const wood = matte(C.woodDark)
  const beam = matte(C.wood)
  const count = B.panels.length
  const w = B.panelW * count + B.gap * (count - 1)
  const top = B.lift + B.h
  for (const side of [-1, 1]) {
    const x = side * (w / 2 + 0.3)
    box(g, wood, 0.62, top + 0.9, 0.62, x, (top + 0.9) / 2, 0)
    box(g, wood, 1.7, 0.36, 0.5, x - side * 0.62, top + 0.62, 0, 0, 0, side * 0.5)
    box(g, wood, 1.1, 0.4, 0.9, x, 0.2, 0)
  }
  box(g, wood, w + 0.2, 0.36, 0.4, 0, top + 0.14, 0)
  box(g, wood, w + 0.2, 0.36, 0.4, 0, B.lift - 0.14, 0)
  box(g, beam, w, B.h, 0.24, 0, B.lift + B.h / 2, -0.04)
  const panels = B.panels.map((panel, i) => {
    const x = (i - (count - 1) / 2) * (B.panelW + B.gap)
    const face = paintLeaderPanel(B, panel, () => career[panel.stat], () => leaders[panel.stat])
    picture(g, face, B.panelW, B.h, x, B.lift + B.h / 2, 0.14)
    if (i) {
      box(g, wood, B.gap, B.h, 0.4, x - (B.panelW + B.gap) / 2, B.lift + B.h / 2, 0)
      box(g, wood, B.gap + 0.3, B.lift - 0.3, 0.46, x - (B.panelW + B.gap) / 2, (B.lift - 0.3) / 2, 0)
    }
    return face
  })
  place(scene, g, B.x, B.z, B.yaw)
  solidBox(w / 2 + 0.6, top / 2, 0.4, B.x, top / 2, B.z, B.yaw)

  let wait = B.refresh
  return (dt) => {
    career.playtime += dt
    if ((wait -= dt) > 0) return
    wait = B.refresh
    for (const face of panels) face.refresh()
  }
}

// A "for sale" board on two stubby posts with square caps.
function saleSign(scene, spec, reg, signs) {
  const W = spec.small ? 3.4 : 4.6
  const H = spec.small ? 1.6 : 2.1
  const lift = spec.small ? 1 : 1.25
  const yaw = spec.yaw
  const g = new Group()
  const wood = matte(C.wood)
  const grain = matte(C.woodDark)
  for (const x of [-W * 0.3, W * 0.3]) {
    box(g, grain, 0.62, lift + 0.2, 0.62, x, (lift + 0.2) / 2, 0)
    box(g, wood, 0.66, 0.5, 0.66, x, lift + H + 0.2, 0)
  }
  box(g, wood, W + 0.14, H + 0.14, 0.34, 0, lift + H / 2, 0)
  picture(g, paintSaleSign(spec), W, H, 0, lift + H / 2, 0.18)
  const bw = (432 / 512) * W
  const bh = 0.34 * H
  const button = { cx: 0, cy: lift + H / 2 + (0.5 - 0.73) * H, w: bw, h: bh, color: '#2f8f2d', sale: spec.id, green: false, cost: () => spec.cost }
  button.tex = paintPriceTag(spec.price, () => button.green, bw / bh)
  const board = reg.add(spec, 0.18, [button])
  const y = spec.y ?? 0
  const model = place(scene, g, spec.x, spec.z, yaw, y)
  const collider = solidBox(W / 2, 1.5, 0.35, spec.x, y + 1.5, spec.z, yaw)
  signs.set(spec.id, {
    show(on) {
      board.off = !on
      board.group.visible = on
      model.visible = on
      collider.setEnabled(on)
    },
  })
}

// A plank pallet, the sawmill's drop-off.
export function pallet(g) {
  const wood = matte(C.woodLight)
  const gap = matte('#a57c50')
  for (let i = 0; i < 3; i++) box(g, wood, 3.4, 0.13, 1.08, 0, 0.08, -1.2 + i * 1.2)
  box(g, gap, 3.3, 0.12, 3.5, 0, 0.05, 0)
  const nail = matte('#5e4532')
  for (const x of [-1.4, 1.4]) for (let i = 0; i < 3; i++) box(g, nail, 0.08, 0.02, 0.08, x, 0.15, -1.2 + i * 1.2)
}

const CLICK_RANGE = 10 // m from the player to the button
const FLOOR_REACH = 5 // m up or down: a sign on another floor can't be pressed
const REST = 0.02 // m a button stands off the face

// Every clickable button on every board. Each one sits in its slot and reacts like a game UI button
// (YARD.buttons): on hover it springs bigger, brightens and gets a glowing outline, a press squashes
// it and it bounces back, a buy flashes it and a refused buy shakes it red. A ray from the cursor is moved into the board's local space and tested against
// the flat face (no mesh raycast needed).
function createButtons(scene) {
  const boards = []
  const all = []
  let hovered = null
  return {
    // defs: [{ cx, cy, w, h, color, tex, price? }] in metres on the face (cx from its centre, cy height).
    add({ x, y = 0, z, yaw = 0 }, planeZ, defs) {
      const g = new Group()
      g.position.set(x, y, z)
      g.rotation.y = yaw
      const board = { x, y, z, cos: Math.cos(yaw), sin: Math.sin(yaw), planeZ, buttons: [], group: g, off: false }
      for (const d of defs) {
        const node = new Group()
        node.position.set(d.cx, d.cy, planeZ + REST)
        box(node, matte(d.color), d.w * 0.98, d.h * 0.98, 0.2, 0, 0, -0.11)
        const o = F.outline * 2
        const outline = picture(node, null, d.w + o, d.h + o)
        outline.material.transparent = true
        outline.material.depthWrite = false
        outline.visible = false
        const face = picture(node, d.tex, d.w, d.h, 0, 0, 0.012)
        g.add(node)
        const b = Object.assign(d, { node, face, outline, k: 1, v: 0, glow: 0, press: 0, flash: 0, deny: 0 })
        board.buttons.push(b)
        all.push(b)
      }
      scene.add(g)
      boards.push(board)
      return board
    },
    pick(ray, from) {
      for (const { x, y, z, cos, sin, planeZ, buttons, off } of boards) {
        if (off || Math.abs(from.y - y) > FLOOR_REACH) continue
        const dx = ray.origin.x - x
        const dz = ray.origin.z - z
        const ox = dx * cos - dz * sin
        const oz = dx * sin + dz * cos
        const ddx = ray.direction.x * cos - ray.direction.z * sin
        const ddz = ray.direction.x * sin + ray.direction.z * cos
        if (Math.abs(ddz) < 1e-6) continue
        const t = (planeZ - oz) / ddz
        if (t <= 0 || t > 80) continue
        // Only buttons within CLICK_RANGE of the player (not the camera, which trails ~17 m behind).
        if (Math.hypot(ray.origin.x + ray.direction.x * t - from.x, ray.origin.z + ray.direction.z * t - from.z) > CLICK_RANGE) continue
        const lx = ox + ddx * t
        const ly = ray.origin.y + ray.direction.y * t - y
        const hit = buttons.find((b) => Math.abs(lx - b.cx) <= b.w / 2 && Math.abs(ly - b.cy) <= b.h / 2)
        if (hit) return hit
      }
      return null
    },
    hover: (b) => (hovered = b),
    // A price tag goes green once the money covers it, grey again if it stops doing so.
    refresh(money) {
      for (const b of all) {
        if (!b.cost) continue
        const price = b.cost()
        const green = price != null && money >= price
        if (green !== b.green) {
          b.green = green
          b.tex.userData.paint()
        }
      }
    },
    repaintRows() {
      for (const b of all) if (b.row) b.tex.userData.paint()
    },
    // result: 'buy', 'deny' or 'press' (nothing to pay for).
    press(b, result) {
      b.press = F.pressTime
      if (result === 'buy') b.flash = 1
      if (result === 'deny') b.deny = 1
    },
    update(dt) {
      const ease = 1 - Math.exp(-dt * 14)
      for (const b of all) {
        b.press = Math.max(0, b.press - dt)
        b.flash = Math.max(0, b.flash - dt / F.flashTime)
        b.deny = Math.max(0, b.deny - dt / F.denyTime)
        b.glow += ((b === hovered ? 1 : 0) - b.glow) * ease
        spring(b, b.press > 0 ? F.pressed : b === hovered ? F.hover : 1, dt)
        b.node.scale.set(b.k, b.k, 1)
        b.node.position.x = b.cx + Math.sin(b.deny * F.denyShakes * Math.PI) * F.denyShake * b.deny
        const light = 1 + b.glow * F.brighten + b.flash * F.flash
        const red = 1 - b.deny * 0.65
        b.face.material.color.setRGB(light, light * red, light * red)
        const opacity = Math.max(b.glow * 0.9, b.flash, b.deny)
        b.outline.visible = opacity > 0.01
        b.outline.material.opacity = opacity
        b.outline.material.color.set(b.deny > 0 ? F.denyColor : F.outlineColor)
      }
    },
  }
}

// The price buttons of an upgrade board face as button defs (their rects are fractions of the face).
function upgradeDefs(spec, face) {
  return face.buttons.map((b) => {
    const w = (b.u1 - b.u0) * spec.w
    const h = (b.v1 - b.v0) * face.h
    const button = {
      cx: ((b.u0 + b.u1) / 2 - 0.5) * spec.w,
      cy: face.cy + (0.5 - (b.v0 + b.v1) / 2) * face.h,
      w,
      h,
      color: '#7d8791',
      row: b.row,
      green: false,
      cost: () => upgradeCost(b.row.id),
    }
    button.tex = paintPriceTag(() => b.row.price, () => button.green, w / h)
    return button
  })
}

// `remote`: a neighbour's yard. Its boards are scenery: nothing there is priced for this player or
// can be pressed, and the Leaderboard stands in the player's own yard only.
export function buildBoards(scene, remote = false) {
  const reg = createButtons(scene)
  for (const s of [YARD.workerBoard, YARD.playerBoard]) reg.add(s, 0.17, upgradeDefs(s, { cy: s.lift + s.h / 2, h: s.h, buttons: upgradeButtons(s) }))
  const faces = [upgradeBoard(scene, YARD.workerBoard), upgradeBoard(scene, YARD.playerBoard)]
  panelSign(scene, YARD.perkSign, YARD.perkSign.w, (YARD.perkSign.h - YARD.perkSign.lift) / YARD.perkSign.panels.length, YARD.perkSign.lift, false, reg)
  const T = YARD.perkTower
  panelSign(scene, T, T.w, (T.h - 0.4) / T.panels.length, 0.4, true, reg)
  const signs = new Map()
  for (const sign of YARD.saleSigns) {
    sign.cost = Number(sign.price.replace(/[^0-9]/g, ''))
    if (!sign.panel && (!remote || !sign.own)) saleSign(scene, sign, reg, signs)
  }
  const updateLeaders = remote ? null : leaderboard(scene)
  return {
    update(dt) {
      if (remote) return
      updateLeaders(dt)
      reg.update(dt)
    },
    pickUpgradeButton: reg.pick,
    hoverUpgradeButton: reg.hover,
    pressUpgradeButton: reg.press,
    refreshPrices: reg.refresh,
    showSign: (id, on) => signs.get(id)?.show(on),
    // After an upgrade: the board faces and price tags read their rows again.
    repaint() {
      for (const f of faces) f.userData.paint()
      reg.repaintRows()
    },
  }
}
