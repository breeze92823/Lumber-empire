import { CanvasTexture, SRGBColorSpace } from 'three'
import { YARD } from '../config.js'
import { fontReady } from '../propkit.js'
import { mulberry32 } from '../textures.js'

// Canvas painters for the yard: sign faces, floor rings, the alert and lock
// icons. Signs repaint once Fredoka has loaded.
const FONT = 'Fredoka, "Arial Black", sans-serif'

// A neighbour's yard paints the same canvases in the same order as the last one, so while
// `remoteTextures` is on every neighbour shares one set instead of holding five.
const remoteSet = []
let remoteAt = -1
export function remoteTextures(on) {
  remoteAt = on ? 0 : -1
}

export function liveTexture(w, h, draw, own = false) {
  if (remoteAt >= 0 && !own) {
    if (remoteAt < remoteSet.length) return remoteSet[remoteAt++]
    const tex = paintedTexture(w, h, draw)
    remoteSet.push(tex)
    remoteAt++
    return tex
  }
  return paintedTexture(w, h, draw)
}

function paintedTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  const paint = () => {
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h)
    tex.needsUpdate = true
  }
  tex.userData.paint = paint
  paint()
  fontReady.then(paint)
  return tex
}

function write(ctx, str, x, y, size, { fill = '#fff', stroke = null, lw = 0, align = 'left', weight = 700, tilt = false } = {}) {
  ctx.font = `${tilt ? 'italic ' : ''}${weight} ${size}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.strokeText(str, x, y)
  }
  ctx.fillStyle = fill
  ctx.fillText(str, x, y)
}

function fillRound(ctx, x, y, w, h, r, fill) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

function sweep(ctx, x, y, w, h, stops, vertical = false) {
  const g = vertical ? ctx.createLinearGradient(x, y, x, y + h) : ctx.createLinearGradient(x, y, x + w, y)
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c))
  return g
}

// Diagonal glass streaks over a band.
function sheen(ctx, x, y, w, h, alpha = 0.22) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = `rgba(255,255,255,${alpha})`
  for (const [at, wide] of [[0.14, 0.09], [0.26, 0.04], [0.62, 0.12], [0.78, 0.05]]) {
    ctx.beginPath()
    const a = x + w * at
    ctx.moveTo(a, y + h)
    ctx.lineTo(a + h, y)
    ctx.lineTo(a + h + w * wide, y)
    ctx.lineTo(a + w * wide, y + h)
    ctx.fill()
  }
  ctx.restore()
}

// The premium-currency hexagon used all over the signs.
function coinIcon(ctx, cx, cy, r, ring = '#f4f1e8', hole = '#9b9a93') {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fillStyle = ring
  ctx.fill()
  ctx.lineWidth = r * 0.14
  ctx.strokeStyle = 'rgba(40,30,10,0.75)'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2)
  ctx.fillStyle = hole
  ctx.fill()
  ctx.stroke()
}

// One "name / sub / progress / price / coin" row.
function upgradeRow(ctx, x, y, w, h, row) {
  fillRound(ctx, x, y, w, h, h * 0.1, '#232d40')
  const nameSize = h * 0.36
  write(ctx, row.name, x + w * 0.03, y + h * 0.34, nameSize, { fill: '#f5f7fb', stroke: '#0d1220', lw: nameSize * 0.12 })
  write(ctx, row.sub, x + w * 0.03, y + h * 0.74, h * 0.25, { fill: '#7ee26d', stroke: '#0d1220', lw: h * 0.05, weight: 600 })
  // Level pips.
  const hasCoin = row.coin != null
  const { tagX, tagW, gap, coinX, coinW } = rowSlots(x, w, hasCoin)
  const pips = 6
  const pipW = w * 0.024
  const pipEnd = tagX - gap * 1.6
  for (let i = 0; i < pips; i++) fillRound(ctx, pipEnd - (pips - i) * (pipW + w * 0.005), y + h * 0.28, pipW, h * 0.44, 2, i < (row.level ?? 0) ? '#7ee26d' : '#3a4458')
  // The price tag is its own raised 3D button (boards.js); the face only holds its empty slot.
  const tagY = y + h * 0.12
  const tagH = h * 0.76
  fillRound(ctx, tagX, tagY, tagW, tagH, 8, '#151c2b')
  if (!hasCoin) return
  // Coin price.
  const gold = sweep(ctx, coinX, y, coinW, h, ['#c8972a', '#f0cf6a', '#c8972a'])
  fillRound(ctx, coinX, tagY, coinW, tagH, 8, gold)
  coinIcon(ctx, coinX + coinW * 0.3, y + h / 2, h * 0.24)
  write(ctx, String(row.coin), coinX + coinW * 0.72, y + h / 2, h * 0.42, { fill: '#2b2110', stroke: '#fbeab5', lw: h * 0.06, align: 'center' })
}

// Horizontal slots of a row's price tag (and coin button, when it has one).
function rowSlots(x, w, hasCoin) {
  const gap = w * 0.015
  const coinW = w * 0.15
  const tagW = hasCoin ? w * 0.2 : w * 0.27
  const coinX = x + w - coinW - gap * 1.4
  const tagX = hasCoin ? coinX - tagW - gap : x + w - tagW - gap * 1.4
  return { tagX, tagW, gap, coinX, coinW }
}

// Board layout shared by the painter and the click test.
function upgradeLayout(spec) {
  const W = 1024
  const H = Math.round((W * spec.h) / spec.w)
  const headH = H * 0.2
  const pad = W * 0.022
  return { W, H, headH, pad, rowH: (H - headH - pad * 4) / 3 }
}

// The price buttons of an upgrade board as fractions of the face (u from the left, v from the top).
export function upgradeButtons(spec) {
  const { W, H, headH, pad, rowH } = upgradeLayout(spec)
  return rowButtons(spec.rows, (i) => [pad, headH + pad + i * (rowH + pad), W - pad * 2, rowH], W, H, (r) => r.green !== false)
}

function rowButtons(rows, rect, W, H, greenOf) {
  return rows.map((row, i) => {
    const [x, y, w, h] = rect(i)
    const green = greenOf(row)
    const { tagX, tagW } = rowSlots(x, w, row.coin != null)
    return { row, green, u0: tagX / W, u1: (tagX + tagW) / W, v0: (y + h * 0.12) / H, v1: (y + h * 0.88) / H }
  })
}

// Event panel layouts (shared by the painters and the click tests).
function eventTopLayout(w, h) {
  const W = 800
  const H = Math.round((W * h) / w)
  const rowH = H * 0.235
  return { W, H, rowH, rect: (i) => [W * 0.03, H * 0.43 + i * (rowH + H * 0.03), W * 0.94, rowH] }
}
function eventLowLayout(w, h) {
  const W = 800
  const H = Math.round((W * h) / w)
  const rowH = H * 0.21
  return { W, H, rowH, rect: (i) => [W * 0.03, H * 0.2 + i * (rowH + H * 0.02), W * 0.94, rowH] }
}
export const eventTopButtons = (spec, w, h) => {
  const L = eventTopLayout(w, h)
  return rowButtons(spec.rows, L.rect, L.W, L.H, () => false)
}
export const eventLowButtons = (spec, w, h) => {
  const L = eventLowLayout(w, h)
  return rowButtons(spec.rows, L.rect, L.W, L.H, (r) => !!r.green)
}

// Worker / Player upgrades: a header band over three rows.
export function paintUpgradeBoard(spec) {
  const { W, H, headH, pad, rowH } = upgradeLayout(spec)
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = '#141b2b'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = sweep(ctx, 0, 0, W, headH, spec.header)
    ctx.fillRect(0, 0, W, headH)
    sheen(ctx, 0, 0, W, headH)
    const size = headH * 0.58
    write(ctx, spec.title, W / 2, headH * 0.54, size, { fill: spec.titleColor, stroke: spec.titleOutline, lw: size * 0.2, align: 'center' })
    spec.rows.forEach((row, i) => upgradeRow(ctx, pad, headH + pad + i * (rowH + pad), W - pad * 2, rowH, row))
  })
}

// The face of a raised price button; `aspect` = width / height of the button. `getPrice` and
// `isGreen` may be plain values or functions read at each repaint (green = affordable).
export function paintPriceTag(getPrice, isGreen, aspect) {
  const H = 128
  const W = Math.round(H * aspect)
  return liveTexture(W, H, (ctx) => {
    const price = typeof getPrice === 'function' ? getPrice() : getPrice
    const green = typeof isGreen === 'function' ? isGreen() : isGreen
    ctx.fillStyle = sweep(ctx, 0, 0, W, H, green ? ['#3fae3a', '#7cd94a', '#3fae3a'] : ['#9aa3ad', '#d3d8de', '#9aa3ad'])
    ctx.fillRect(0, 0, W, H)
    sheen(ctx, 0, 0, W, H, 0.16)
    const size = Math.min(H * 0.6, (W * 0.8) / Math.max(price.length, 3))
    write(ctx, price, W / 2, H / 2, size, { fill: '#fff', stroke: green ? '#1f6b24' : '#555c66', lw: size * 0.22, align: 'center' })
  })
}

// The Halloween event panel (top of the double board).
export function paintEventTop(spec, w, h) {
  const { W, H, rowH, rect } = eventTopLayout(w, h)
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = '#141b2b'
    ctx.fillRect(0, 0, W, H)
    const headH = H * 0.15
    ctx.fillStyle = sweep(ctx, 0, 0, W, headH, ['#7b3df0', '#c257e0', '#f08a2c'])
    ctx.fillRect(0, 0, W, headH)
    sheen(ctx, 0, 0, W, headH)
    write(ctx, spec.title, W / 2, headH * 0.54, headH * 0.6, { fill: '#f2e6ff', stroke: '#3c1a78', lw: headH * 0.11, align: 'center' })
    write(ctx, spec.progress, W / 2, H * 0.215, H * 0.058, { fill: '#ffa43a', stroke: '#2a1405', lw: H * 0.012, align: 'center', tilt: true })
    const barX = W * 0.09
    const barW = W * 0.82
    const barY = H * 0.27
    const barH = H * 0.05
    fillRound(ctx, barX, barY, barW, barH, barH / 2, '#2c3548')
    fillRound(ctx, barX, barY, barW * spec.fill, barH, barH / 2, sweep(ctx, barX, 0, barW * spec.fill, 1, ['#f0782c', '#ffb13d']))
    write(ctx, spec.note, W / 2, H * 0.37, H * 0.046, { fill: '#c7cede', stroke: '#0d1220', lw: H * 0.008, align: 'center', weight: 600, tilt: true })
    spec.rows.forEach((row, i) => upgradeRow(ctx, ...rect(i), { ...row, green: false }))
  })
}

// The lower panel: tree luck upgrades plus the odds list.
export function paintEventLow(spec, w, h) {
  const { W, H, rowH, rect } = eventLowLayout(w, h)
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = '#141b2b'
    ctx.fillRect(0, 0, W, H)
    const headH = H * 0.17
    ctx.fillStyle = sweep(ctx, 0, 0, W, headH, ['#c98f1e', '#f4d067', '#c58a1d'])
    ctx.fillRect(0, 0, W, headH)
    sheen(ctx, 0, 0, W, headH)
    write(ctx, spec.title, W / 2, headH * 0.54, headH * 0.58, { fill: '#fff4d6', stroke: '#6e5012', lw: headH * 0.12, align: 'center' })
    spec.rows.forEach((row, i) => upgradeRow(ctx, ...rect(i), { ...row, green: !!row.green }))
    spec.odds.forEach(([text, color], i) => {
      write(ctx, text, W * 0.05, H * (0.685 + i * 0.082), H * 0.064, { fill: color, stroke: '#0d1220', lw: H * 0.012 })
    })
  })
}

// Colour panels: a title, a small line and a coin, for the perk signs.
export function paintPerkPanel(panel, W = 512, H = 256) {
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = sweep(ctx, 0, 0, W, H, panel.colors)
    ctx.fillRect(0, 0, W, H)
    sheen(ctx, 0, 0, W, H, 0.14)
    const size = Math.min(H * 0.27, (W * 1.5) / panel.title.length)
    write(ctx, panel.title, W / 2, H * 0.4, size, { fill: '#fff', stroke: '#14151f', lw: size * 0.22, align: 'center', tilt: true })
    write(ctx, panel.sub, W / 2, H * 0.7, H * 0.12, { fill: '#7dff8a', stroke: '#14151f', lw: H * 0.03, align: 'center' })
  })
}

// Wooden "for sale" sign: gold title over a green price strip.
export function paintSaleSign({ title, price }) {
  const W = 512
  const H = 240
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = sweep(ctx, 0, 0, W, H, ['#c98a4b', '#b47a3e'], true)
    ctx.fillRect(0, 0, W, H)
    const size = Math.min(92, (W * 1.5) / title.length)
    write(ctx, title, W / 2, H * 0.32, size, { fill: '#ffe56b', stroke: '#2b1a0a', lw: size * 0.2, align: 'center' })
    const y = H * 0.56
    const h = H * 0.34
    // Empty slot: the price is a raised button (boards.js).
    ctx.fillStyle = '#2a3a1c'
    ctx.fillRect(40, y, W - 80, h)
  })
}

// One repeat of a cleated belt, running along the texture's height: rubber with worn lanes down
// its edges and a raised chevron across it. Wraps, so scrolling it moves the belt.
export function paintBelt() {
  const W = 128
  const H = 128
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = '#343a48'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#2a2f3b'
    for (const x of [0, W - 16]) ctx.fillRect(x, 0, 16, H)
    ctx.strokeStyle = '#596173'
    ctx.lineWidth = 15
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(14, 88)
    ctx.lineTo(W / 2, 40)
    ctx.lineTo(W - 14, 88)
    ctx.stroke()
    ctx.strokeStyle = '#7a8295'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(14, 83)
    ctx.lineTo(W / 2, 35)
    ctx.lineTo(W - 14, 83)
    ctx.stroke()
  })
}

// --- Leaderboard ----------------------------------------------------------------
const MONEY_UNITS = ['', 'K', 'M', 'B', 'T', 'Qa']

// 7650000 -> "$7.65M", 9e15 -> "$9Qa".
function bigMoney(n) {
  let unit = 0
  while (n >= 1000 && unit < MONEY_UNITS.length - 1) {
    n /= 1000
    unit++
  }
  return `$${+n.toPrecision(3)}${MONEY_UNITS[unit]}`
}

// 208000 -> "2d 9h", 11700 -> "3h 15m", 90 -> "1m".
function playTime(s) {
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d) return `${d}d ${h % 24}h`
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

const LEADER_TEXT = { count: String, money: bigMoney, time: playTime }

// A blocky round head, the same every time for one name.
function leaderHead(ctx, { skins, hair }, name, cx, cy, r) {
  const rand = mulberry32([...name].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) | 0, 7))
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#2d3550'
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.fillStyle = skins[Math.floor(rand() * skins.length)]
  ctx.beginPath()
  ctx.arc(cx, cy + r * 0.2, r * 0.74, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = hair[Math.floor(rand() * hair.length)]
  ctx.beginPath()
  ctx.arc(cx, cy + r * 0.04, r * 0.82, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = '#1a1420'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(cx + side * r * 0.3, cy + r * 0.26, r * 0.11, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// One panel: an orange title band, the top rows, then the player's row in blue and gold.
// read() = the player's number, top() = the server's { rows: [{ name, value }], rank, you }: rank is
// null off the list or when unknown, you = the player's name on it. Until the server says otherwise
// the player joins the list on beating a row in it. Returns the texture with a refresh() that
// repaints only when that number or the server's list has changed.
export function paintLeaderPanel(B, { title, format, youColor }, read, top) {
  const W = 512
  const H = Math.round((W * B.h) / B.panelW)
  const headH = H * 0.125
  const youH = H * 0.108
  const pad = H * 0.011
  const rowH = (H - headH - youH - pad * (B.rows + 3)) / B.rows
  const text = LEADER_TEXT[format]
  let shown = ''
  let list = null
  const tex = liveTexture(W, H, (ctx) => {
    const value = read()
    list = top()
    const others = list.rows.filter((r) => r.name !== list.you)
    let at = others.findIndex((r) => value > r.value)
    if (at < 0 && value > 0 && others.length < B.rows) at = others.length
    const rows = (at < 0 ? others : [...others.slice(0, at), { name: B.you, value }, ...others.slice(at)]).slice(0, B.rows)
    const place = at < 0 ? list.rank : at + 1
    shown = text(value)
    ctx.fillStyle = '#0e1320'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = sweep(ctx, 0, 0, W, headH, ['#ffbe2e', '#f58a1f', '#e8651a'], true)
    ctx.fillRect(0, 0, W, headH)
    sheen(ctx, 0, 0, W, headH)
    const size = Math.min(headH * 0.58, (W * 1.42) / title.length)
    write(ctx, title, W / 2, headH * 0.53, size, { fill: '#fff', stroke: '#4a2508', lw: size * 0.2, align: 'center' })

    const x = pad * 1.4
    const w = W - x * 2
    rows.forEach((row, i) => {
      const y = headH + pad * (i + 1) + rowH * i
      const you = row.name === B.you
      fillRound(ctx, x, y, w, rowH, rowH * 0.16, you ? '#27408a' : '#1b2130')
      const line = rowH * 0.52
      write(ctx, `#${i + 1}`, x + 14, y + rowH / 2, line * 0.96, { fill: B.medals[i] ?? '#f5f7fb', stroke: '#0d1220', lw: line * 0.14 })
      leaderHead(ctx, B, row.name, x + 104, y + rowH / 2, rowH * 0.4)
      write(ctx, row.name, x + 138, y + rowH / 2, line, { fill: you ? '#ffd23f' : '#f5f7fb', stroke: '#0d1220', lw: line * 0.12, weight: 600 })
      write(ctx, text(row.value), x + w - 12, y + rowH / 2, line, { fill: '#7ee26d', stroke: '#0d1220', lw: line * 0.14, align: 'right' })
    })

    const y = H - youH - pad * 1.4
    fillRound(ctx, x, y, w, youH, youH * 0.18, '#f2c531')
    fillRound(ctx, x + 5, y + 5, w - 10, youH - 10, youH * 0.14, sweep(ctx, x, y, w, youH, ['#2f6cf2', '#1a44b8'], true))
    const mid = y + youH / 2
    write(ctx, place ? `#${place}` : B.unranked, x + 16, mid, youH * 0.27, { fill: '#fff', stroke: '#0d1f55', lw: youH * 0.05 })
    leaderHead(ctx, B, B.you, x + 110, mid, youH * 0.36)
    write(ctx, B.you, x + 150, mid, youH * 0.46, { fill: '#fff', stroke: '#0d1f55', lw: youH * 0.07 })
    write(ctx, shown, x + w - 18, mid, youH * 0.42, { fill: youColor, stroke: '#0d1f55', lw: youH * 0.07, align: 'right' })
  })
  return Object.assign(tex, {
    refresh() {
      if (text(read()) !== shown || top() !== list) tex.userData.paint()
    },
  })
}

export function paintBanner(text, { fill = '#ffe15a', bg = '#a8892f', edge = '#3b3013', w = 512, h = 128 } = {}) {
  return liveTexture(w, h, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = edge
    ctx.lineWidth = 14
    ctx.strokeRect(7, 7, w - 14, h - 14)
    const size = Math.min(h * 0.62, (w * 1.45) / text.length)
    write(ctx, text, w / 2, h * 0.54, size, { fill, stroke: '#20190a', lw: size * 0.2, align: 'center' })
  })
}

// The tunnel is unlit by anything real: its lamps' light is painted on. One repeat of a wall, a lamp's
// pool of warm light on rough rock between two timber sets.
export function paintTunnelWall() {
  const W = 512
  const H = 256
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = '#231c1a'
    ctx.fillRect(0, 0, W, H)
    const rand = mulberry32(61)
    for (let i = 0; i < 260; i++) {
      const v = 26 + rand() * 34
      ctx.fillStyle = `rgb(${v + 8},${v},${v - 6})`
      ctx.beginPath()
      ctx.ellipse(rand() * W, rand() * H, 8 + rand() * 34, 5 + rand() * 18, rand() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    const pool = ctx.createRadialGradient(W / 2, H * 0.1, 8, W / 2, H * 0.1, W * 0.52)
    pool.addColorStop(0, 'rgba(255,196,110,0.82)')
    pool.addColorStop(0.45, 'rgba(226,132,60,0.34)')
    pool.addColorStop(1, 'rgba(90,40,20,0)')
    ctx.fillStyle = pool
    ctx.fillRect(0, 0, W, H)
    const foot = ctx.createLinearGradient(0, H * 0.7, 0, H)
    foot.addColorStop(0, 'rgba(0,0,0,0)')
    foot.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = foot
    ctx.fillRect(0, 0, W, H)
  })
}

// One repeat of the floor: packed dirt with the lamp's light across it and a wet patch.
export function paintTunnelFloor() {
  const W = 256
  const H = 256
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = '#2c2422'
    ctx.fillRect(0, 0, W, H)
    const rand = mulberry32(62)
    for (let i = 0; i < 420; i++) {
      const v = 34 + rand() * 30
      ctx.fillStyle = `rgba(${v + 10},${v + 2},${v - 6},0.8)`
      ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 5, 1 + rand() * 4)
    }
    const pool = ctx.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, W * 0.55)
    pool.addColorStop(0, 'rgba(255,190,110,0.58)')
    pool.addColorStop(1, 'rgba(120,60,30,0)')
    ctx.fillStyle = pool
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(150,180,210,0.14)'
    ctx.beginPath()
    ctx.ellipse(W * 0.66, H * 0.7, 46, 22, 0.4, 0, Math.PI * 2)
    ctx.fill()
  })
}

// One repeat of the roof: rough lagging boards running across, lit under each lamp.
export function paintTunnelRoof() {
  const W = 256
  const H = 256
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = '#1f1714'
    ctx.fillRect(0, 0, W, H)
    const rand = mulberry32(63)
    for (let x = 0; x < W; x += 21) {
      const v = 36 + rand() * 22
      ctx.fillStyle = `rgb(${v + 12},${v},${v - 10})`
      ctx.fillRect(x, 0, 18, H)
    }
    const pool = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W * 0.5)
    pool.addColorStop(0, 'rgba(255,214,140,0.9)')
    pool.addColorStop(0.5, 'rgba(226,140,70,0.28)')
    pool.addColorStop(1, 'rgba(90,40,20,0)')
    ctx.fillStyle = pool
    ctx.fillRect(0, 0, W, H)
  })
}

// Yellow and black, for edges that bite.
export function paintHazard() {
  const W = 256
  const H = 32
  return liveTexture(W, H, (ctx) => {
    ctx.fillStyle = '#f2c21c'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#1b1c22'
    for (let x = -H; x < W + H; x += 44) {
      ctx.beginPath()
      ctx.moveTo(x, H)
      ctx.lineTo(x + 22, H)
      ctx.lineTo(x + 22 + H, 0)
      ctx.lineTo(x + H, 0)
      ctx.fill()
    }
  })
}

// The airport fence's chain link: one diamond of wire on nothing, to repeat.
export function paintChainLink() {
  const W = 64
  const H = 64
  return liveTexture(W, H, (ctx) => {
    ctx.strokeStyle = '#b4bbc4'
    ctx.lineWidth = 3.2
    ctx.beginPath()
    for (const [ax, ay, bx, by] of [[0, H / 2, W / 2, 0], [W / 2, 0, W, H / 2], [W, H / 2, W / 2, H], [W / 2, H, 0, H / 2]]) {
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
    }
    ctx.stroke()
  })
}

// Lettering down a plane's side or a fin, on nothing.
export function paintAirMark(text, fill, stroke, w = 768, h = 128) {
  return liveTexture(w, h, (ctx) => {
    const size = Math.min(h * 0.74, (w * 1.42) / text.length)
    write(ctx, text, w / 2, h / 2, size, { fill, stroke, lw: size * 0.08, align: 'center', weight: 800 })
  })
}

// A pine on the fin, the firm's mark.
export function paintFinMark(fill) {
  const S = 256
  return liveTexture(S, S, (ctx) => {
    ctx.fillStyle = fill
    for (const [y, w] of [[34, 60], [86, 88], [140, 116]]) {
      ctx.beginPath()
      ctx.moveTo(S / 2, y - 26)
      ctx.lineTo(S / 2 + w, y + 62)
      ctx.lineTo(S / 2 - w, y + 62)
      ctx.fill()
    }
    ctx.fillRect(S / 2 - 16, 200, 32, 40)
  })
}

// Runway numbers and other paint on the ground: white on nothing.
export function paintGroundText(text) {
  const W = 256
  const H = 256
  return liveTexture(W, H, (ctx) => {
    write(ctx, text, W / 2, H / 2, 220, { fill: '#f2f1ea', align: 'center' })
  })
}

// How full a truck is, floating over its cab.
export function paintLoadTag(text) {
  const W = 512
  const H = 96
  return liveTexture(W, H, (ctx) => {
    write(ctx, text(), W / 2, H / 2, 72, { fill: '#ffffff', stroke: '#20242e', lw: 14, align: 'center' })
  }, true)
}

// The x$5 over a lucky truck.
export function paintLuckyTag(text) {
  const W = 256
  const H = 128
  return liveTexture(W, H, (ctx) => {
    write(ctx, text(), W / 2, H / 2, 104, { fill: '#ffd76a', stroke: '#7a3b12', lw: 18, align: 'center' })
  }, true)
}

// A machine's ON / OFF (or NEXT / PALLET) sign. state() = true for green, false for grey, or
// 'blue' for an output going to the trucks.
const SWITCH = {
  true: { face: ['#7fe635', '#3fbf2c', '#2c9a24'], edge: '#205a1a', ink: '#1b3f14' },
  false: { face: ['#b4bcc4', '#8b949d', '#6d767f'], edge: '#3b424a', ink: '#2c3238' },
  blue: { face: ['#6fc0ff', '#2f86f0', '#1f62cc'], edge: '#123f86', ink: '#0f2f66' },
}
export function paintSwitch(text, state) {
  const W = 512
  const H = 132
  return liveTexture(W, H, (ctx) => {
    const look = SWITCH[state()]
    const word = text()
    ctx.fillStyle = sweep(ctx, 0, 0, W, H, look.face, true)
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = look.edge
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, W - 10, H - 10)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath()
    ctx.moveTo(90, H)
    ctx.lineTo(160, 0)
    ctx.lineTo(240, 0)
    ctx.lineTo(170, H)
    ctx.fill()
    const size = Math.min(94, (W * 1.4) / word.length)
    write(ctx, word, W / 2, H / 2 + 4, size, { fill: '#ffffff', stroke: look.ink, lw: 16, align: 'center' })
  }, true)
}

// --- Floor rings ----------------------------------------------------------------
// Two layers: a fixed soft disc with the word, and a rotor (thick ring + inner
// arc + two white ticks) that turns.
export function paintRingBase(color, text, dark = false) {
  const S = 512
  return liveTexture(S, S, (ctx) => {
    const c = S / 2
    const fill = ctx.createRadialGradient(c, c, 0, c, c, c * 0.92)
    fill.addColorStop(0, dark ? 'rgba(52,56,66,0.9)' : 'rgba(255,255,255,0.16)')
    fill.addColorStop(0.85, dark ? 'rgba(60,64,74,0.9)' : `${color}30`)
    fill.addColorStop(1, dark ? 'rgba(60,64,74,0.9)' : `${color}55`)
    ctx.beginPath()
    ctx.arc(c, c, c * 0.92, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    const size = Math.min(120, 440 / text.length)
    write(ctx, text, c, c, size, { fill: '#fffbe8', stroke: color, lw: size * 0.2, align: 'center' })
  })
}
export function paintRingRotor(color) {
  const S = 512
  return liveTexture(S, S, (ctx) => {
    const c = S / 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = 22
    ctx.beginPath()
    ctx.arc(c, c, c * 0.92, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(c, c, c * 0.74, 0.2, 2.4)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(c, c, c * 0.74, 3.4, 5.5)
    ctx.stroke()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 22
    for (const a of [0.9, 0.9 + Math.PI]) {
      ctx.beginPath()
      ctx.arc(c, c, c * 0.92, a, a + 0.17)
      ctx.stroke()
    }
  })
}
// The dark halo round the locked Hacker: a black ring around a green glow.
export function paintHackerRing() {
  const S = 512
  return liveTexture(S, S, (ctx) => {
    const c = S / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.92)
    g.addColorStop(0, 'rgba(70,255,130,0.5)')
    g.addColorStop(0.75, 'rgba(70,255,130,0.14)')
    g.addColorStop(1, 'rgba(70,255,130,0.02)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(c, c, c * 0.92, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(8,16,12,0.86)'
    ctx.lineWidth = 11
    ctx.beginPath()
    ctx.arc(c, c, c * 0.93, 0, Math.PI * 2)
    ctx.stroke()
  })
}

// --- Billboards -----------------------------------------------------------------
export function paintAlert() {
  const S = 256
  return liveTexture(S, S, (ctx) => {
    const c = S / 2
    ctx.beginPath()
    ctx.arc(c, c, c * 0.96, 0, Math.PI * 2)
    ctx.fillStyle = '#ecebe8'
    ctx.fill()
    const g = ctx.createRadialGradient(c, c * 0.85, 10, c, c, c * 0.72)
    g.addColorStop(0, '#e8232f')
    g.addColorStop(1, '#a30f1c')
    ctx.beginPath()
    ctx.arc(c, c, c * 0.7, 0, Math.PI * 2)
    ctx.fillStyle = g
    ctx.fill()
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(0.1)
    fillRound(ctx, -14, -68, 28, 88, 12, '#fff')
    ctx.beginPath()
    ctx.arc(0, 48, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
}

export function paintLock() {
  const W = 256
  const H = 320
  return liveTexture(W, H, (ctx) => {
    const cx = W / 2
    const edge = '#6b0d12'
    // Shackle: dark outline, then pale steel.
    ctx.lineCap = 'butt'
    ctx.strokeStyle = edge
    ctx.lineWidth = 58
    ctx.beginPath()
    ctx.moveTo(cx - 70, 170)
    ctx.lineTo(cx - 70, 96)
    ctx.arc(cx, 96, 70, Math.PI, 0)
    ctx.lineTo(cx + 70, 170)
    ctx.stroke()
    ctx.strokeStyle = '#dfe5ee'
    ctx.lineWidth = 36
    ctx.stroke()
    // Body.
    fillRound(ctx, 22, 136, W - 44, 168, 38, edge)
    const g = ctx.createLinearGradient(0, 146, 0, 294)
    g.addColorStop(0, '#fdf28a')
    g.addColorStop(0.45, '#f0d52c')
    g.addColorStop(0.5, '#ffe948')
    g.addColorStop(1, '#d7ab12')
    fillRound(ctx, 34, 148, W - 68, 144, 30, g)
    // Keyhole.
    ctx.fillStyle = '#c0261a'
    ctx.beginPath()
    ctx.arc(cx, 206, 25, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx - 13, 214)
    ctx.lineTo(cx + 13, 214)
    ctx.lineTo(cx + 20, 262)
    ctx.lineTo(cx - 20, 262)
    ctx.closePath()
    ctx.fill()
  })
}

// A two-line overhead tag with a price, for the OP truck and the Hacker.
export function paintShopTag({ title, sub, price, titleColor, outline }) {
  const W = 760
  const H = 300
  return liveTexture(W, H, (ctx) => {
    write(ctx, title, W / 2, 62, 96, { fill: titleColor, stroke: outline, lw: 16, align: 'center' })
    write(ctx, sub, W / 2, 158, 44, { fill: '#fff', stroke: '#101018', lw: 11, align: 'center' })
    write(ctx, price, W / 2, 238, 62, { fill: '#ffe38a', stroke: '#2a1e06', lw: 12, align: 'center' })
  })
}

export function paintPumpkin() {
  const S = 128
  return liveTexture(S, S, (ctx) => {
    ctx.fillStyle = YARD.eventBoard.pumpkin
    ctx.fillRect(0, 0, S, S)
    ctx.fillStyle = '#ffe65a'
    ctx.fillRect(28, 36, 22, 22)
    ctx.fillRect(78, 36, 22, 22)
    ctx.fillRect(26, 78, 76, 16)
    ctx.fillStyle = YARD.eventBoard.pumpkin
    ctx.fillRect(44, 78, 12, 8)
    ctx.fillRect(72, 86, 12, 8)
  })
}

// --- Ground ---------------------------------------------------------------------
// Pale concrete, one texture over the whole floor: soft cloudy variation plus
// baked contact shade under the big things, which is what makes the reference's
// flat floor look grounded.
export function paintConcrete(contacts) {
  const { concrete: C } = YARD
  const S = C.size
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = C.color
  ctx.fillRect(0, 0, S, S)
  const rand = mulberry32(31)
  for (let i = 0; i < 90; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = S * (0.05 + rand() * 0.14)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const tone = rand() < 0.5 ? '255,250,240' : '150,150,165'
    g.addColorStop(0, `rgba(${tone},0.06)`)
    g.addColorStop(1, `rgba(${tone},0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const sx = S / (C.east - C.west)
  const sz = S / (C.south - C.north)
  for (const { x, z, rx, rz, a = 0.3 } of contacts) {
    ctx.save()
    ctx.translate((x - C.west) * sx, (z - C.north) * sz)
    ctx.scale(rx * sx, rz * sz)
    const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1)
    g.addColorStop(0, `rgba(60,62,84,${a})`)
    g.addColorStop(0.6, `rgba(60,62,84,${a * 0.55})`)
    g.addColorStop(1, 'rgba(60,62,84,0)')
    ctx.fillStyle = g
    ctx.fillRect(-1, -1, 2, 2)
    ctx.restore()
  }
  return c
}

// Grass: flat colour with big soft mottling (the reference's smooth plastic lawn).
export function paintTurf() {
  const { grass } = YARD
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = grass.color
  ctx.fillRect(0, 0, S, S)
  const rand = mulberry32(12)
  for (let i = 0; i < 60; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = 30 + rand() * 80
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r)
        g.addColorStop(0, `${grass.spot}38`)
        g.addColorStop(1, `${grass.spot}00`)
        ctx.fillStyle = g
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2)
      }
    }
  }
  return c
}
