import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping } from 'three'
import * as sfx from '../audio/sfx.js'
import { AIR, GAME, YARD } from '../config.js'
import { solidPole } from '../propkit.js'
import { along } from './feeds.js'
import { bar, box, matte, place } from './kit.js'
import { polyline, room } from './line.js'
import { paintBelt } from './paint.js'
import { buildRun } from './tunnel.js'

// How wood gets from the line to the planes, as the Bay Conveyers get it to the trucks. The Cargo
// Trunk stands on stilts up the east side of the line, from the Workshop's corner to a chute over the
// Tunnel Conveyor's hopper. An Air Link joins one machine's belt on one floor to it: a diverter arm at
// the end of that belt swings items onto a slanting spur, clear of the lifter towers, and an upper
// floor's spur ends in a drop shaft down to the trunk. Like a Bay Conveyer a link only takes what the
// next machine can't keep up with, so the line never starves; where the line stops at that machine it
// takes everything, and past the last machine the plane comes before the Truck Conveyer.
const L = GAME.line
const K = AIR.trunk
const B = AIR.belt
const { colors: C } = YARD
const STEEL = '#8f949c'

// Where a stage's spur starts on its floor and comes down over the trunk, and how far along the trunk
// that is.
function spurOf(stage, base) {
  const [west, corner, top] = K.path
  const y = base + L.beltY
  const m = L.machines[stage]
  if (stage === L.machines.length - 1) return { from: [west[0], y, L.path.at(-1)[1]], to: [west[0], west[2]], d: 0 }
  const z = m.z + m.belt
  const joinZ = z + K.spur
  return { from: [L.x, y, z], to: [corner[0], joinZ], d: Math.abs(corner[0] - west[0]) + (corner[2] - joinZ) }
}

// The shaft an upper floor's items come down, shared by every floor of a stage.
function buildShaft(x, z, height) {
  const g = new Group()
  const yellow = matte(C.guardRail)
  const dark = matte(C.navy)
  const half = K.width / 2 + 0.12
  for (const dx of [-half, half]) for (const dz of [-half, half]) box(g, yellow, 0.16, height, 0.16, x + dx, K.path[0][1] + height / 2, z + dz)
  for (let y = K.path[0][1] + 2; y < K.path[0][1] + height; y += 2) {
    for (const dz of [-half, half]) box(g, dark, half * 2, 0.1, 0.1, x, y, z + dz)
    for (const dx of [-half, half]) box(g, dark, 0.1, 0.1, half * 2, x + dx, y, z)
  }
  return g
}

function belted(root, legs, mat) {
  for (const leg of legs) {
    const geo = new PlaneGeometry(leg.width ?? B.width, leg.len).rotateX(-Math.PI / 2)
    const uv = geo.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * leg.len) / B.cleatEvery)
    const strip = new Mesh(geo, mat)
    strip.position.copy(leg.g.position)
    strip.rotation.copy(leg.g.rotation)
    strip.translateY(-0.03)
    strip.receiveShadow = true
    root.add(strip)
  }
}

function buildStilt(g, x, z, y) {
  const steel = matte(C.navy)
  box(g, steel, 0.24, y - 0.3, 0.24, x, (y - 0.3) / 2, z)
  box(g, steel, 2, 0.16, 0.24, x, y - 0.46, z)
  box(g, matte('#b9b5ad'), 0.8, 0.14, 0.8, x, 0.07, z)
}

export function buildAirLinks(scene, { lines, items, tunnel, bursts, roomFor }) {
  const tex = paintBelt()
  tex.wrapS = tex.wrapT = RepeatWrapping
  const mat = new MeshStandardMaterial({ map: tex, roughness: 0.82 })

  // The trunk: everything standing is one group, shown with the Tunnel Conveyor.
  const trunkRun = polyline(K.path)
  const trunk = new Group()
  trunk.visible = false
  scene.add(trunk)
  const model = new Group()
  const legs = K.path.slice(1).map((b, i) => along(K.path[i], b))
  for (const { g, len } of legs) {
    buildRun(g, len)
    model.add(g)
  }
  const solids = []
  const stilt = (x, z, y = K.path[0][1]) => {
    buildStilt(model, x, z, y)
    const pole = solidPole(0.2, y, x, z)
    pole.setEnabled(false)
    solids.push(pole)
  }
  const [west, corner, top, end] = K.path
  for (let x = west[0] + 2; x < corner[0]; x += K.legEvery) stilt(x, corner[2])
  for (let z = corner[2]; z > top[2]; z -= K.legEvery) stilt(corner[0], z)
  stilt(top[0], top[2])
  box(model, matte('#566072', { roughness: 0.5, metalness: 0.3 }), 1.5, 0.08, 1.7, end[0] + 0.3, end[1] - 0.4, end[2], 0, 0, -0.6) // the chute's lip
  place(trunk, model)
  belted(trunk, legs, mat)

  const riding = [] // on the trunk, furthest along first: { item, d }
  const spot = { at: null, yaw: 0, pitch: 0 }
  let moving = false

  function join(item, d) {
    if (!riding.every((b) => Math.abs(b.d - d) >= room(item, b.item))) return false
    let at = 0
    while (at < riding.length && riding[at].d > d) at++
    riding.splice(at, 0, { item, d })
    return true
  }

  // One link: a stage on a floor.
  function createLink(line, stage) {
    const m = line.stages[stage]
    const spur = spurOf(stage, line.base)
    const top = K.from
    const [tx, tz] = spur.to
    const raised = line.floor > 0
    const pts = raised ? [spur.from, [tx, spur.from[1], tz], [tx, top, tz]] : [spur.from, [tx, top, tz]]
    const run = polyline(pts)
    const flatLen = raised ? Math.hypot(tx - spur.from[0], tz - spur.from[2]) : Infinity
    const root = new Group()
    root.visible = false
    scene.add(root)
    const leg = along(pts[0], pts[1])
    const frame = new Group()
    buildRun(leg.g, leg.len)
    frame.add(leg.g)
    const mid = pts[0].map((v, i) => (v + pts[1][i]) / 2)
    if (!raised) buildStilt(frame, mid[0], mid[2], mid[1])
    place(root, frame)
    belted(root, [leg], mat)

    // The diverter: an arm on the belt's far rail, swung across to steer an item off.
    const arm = new Group()
    const yaw = leg.g.rotation.y
    box(arm, matte('#f2c21c'), 0.14, 0.6, 2.5, 0, 0, -1.25)
    for (let i = 0; i < 5; i++) box(arm, matte('#12151f'), 0.15, 0.2, 0.2, 0, 0, -0.3 - i * 0.48, 0, 0.6)
    bar(arm, matte(STEEL), 0.14, 1.1, 0, 0.1, 0, 'y', 10)
    const pivot = stage === 4 ? [spur.from[0] + 1.1, spur.from[1] + 0.4, spur.from[2] + 1.2] : [spur.from[0] + 1.15, spur.from[1] + 0.4, spur.from[2] + 1]
    const swing = place(root, arm, pivot[0], pivot[2], yaw, pivot[1])
    const rest = yaw + 1.2
    swing.rotation.y = rest

    const list = [] // furthest along first: { item, d }
    let kick = 0
    let built = false
    const link = {
      get built() {
        return built
      },
      riding: () => list.length,
      // Off the end of the machine's belt. `spare`: the next machine can't use it, or there's none.
      take(item, spare) {
        if (!spare || roomFor() <= 0) return false
        const last = list.at(-1)
        if (last && last.d < room(item, last.item)) return false
        list.push({ item, d: 0 })
        kick = K.kick
        sfx.kicker(pivot[0], pivot[1], pivot[2])
        return true
      },
      build() {
        built = true
        root.visible = true
        m.air = link
        shafts[stage]?.show(line.floor)
        items.burst(spur.from[0], spur.from[1] + 1, spur.from[2], 26)
      },
      reset() {
        built = false
        root.visible = false
        list.length = 0
        kick = 0
      },
      update(dt, step) {
        if (!built) return false
        let turning = false
        for (let i = 0; i < list.length; i++) {
          const b = list[i]
          const ahead = i ? list[i - 1].d - room(b.item, list[i - 1].item) : Infinity
          const d = Math.min(b.d + step, run.length, Math.max(ahead, b.d))
          if (d > b.d) turning = true
          b.d = d
          if (!i && b.d >= run.length && join(b.item, spur.d)) {
            list.shift()
            i--
            continue
          }
          run.at(b.d, spot)
          const sinks = b.d > flatLen // standing on end, down the shaft
          const turn = Math.min(1, b.d / 1.4)
          items.add(b.item, spot.at[0], spot.at[1] + items.rest(b.item), spot.at[2], spot.yaw * turn, 1, sinks ? 0 : spot.pitch * turn)
        }
        kick = Math.max(0, kick - dt)
        swing.rotation.y += ((kick > 0 ? yaw - 0.4 : rest) - swing.rotation.y) * Math.min(1, dt * 16)
        return turning
      },
    }
    return link
  }

  // The drop shafts, one to a stage, as tall as the highest floor linked.
  const shafts = L.machines.map((m, stage) => {
    const [tx, tz] = spurOf(stage, 0).to
    const tall = (floor) => floor * YARD.floors.y + L.beltY + K.shaftTop + 5 - K.path[0][1]
    const parts = [1, 2].map((floor) => {
      const shaft = place(scene, buildShaft(tx, tz, tall(floor)))
      shaft.visible = false
      return shaft
    })
    return {
      show(floor) {
        if (!floor) return
        parts[0].visible = floor === 1 && !parts[1].visible
        if (floor === 2) parts[1].visible = true
      },
      reset() {
        for (const p of parts) p.visible = false
      },
    }
  })

  const links = lines.map((line) => line.stages.map((_, stage) => createLink(line, stage)))
  const all = links.flat()

  return {
    get moving() {
      return moving
    },
    get owned() {
      return trunk.visible
    },
    // What is on its way, trunk and links together.
    get riding() {
      return riding.length + all.reduce((n, l) => n + l.riding(), 0)
    },
    show() {
      trunk.visible = true
      for (const c of solids) c.setEnabled(true)
    },
    build: (floor, stage) => links[floor][stage].build(),
    reset() {
      trunk.visible = false
      for (const c of solids) c.setEnabled(false)
      riding.length = 0
      for (const l of all) l.reset()
      for (const s of shafts) s.reset()
    },
    // The nearest point of the trunk to (x, z), for its sound.
    nearest(x, z, to) {
      const [ , corner, top] = K.path
      if (z < corner[2] - 1) {
        to.x = corner[0]
        to.z = Math.max(top[2], z)
      } else {
        to.x = Math.min(corner[0], x)
        to.z = corner[2]
      }
      to.y = corner[1]
      return to
    },
    update(dt) {
      if (!trunk.visible) return
      const step = B.speed * tunnel.boost * dt
      let turning = false
      for (const l of all) if (l.update(dt, step)) turning = true
      for (let i = 0; i < riding.length; i++) {
        const b = riding[i]
        const ahead = i ? riding[i - 1].d - room(b.item, riding[i - 1].item) : Infinity
        const d = Math.min(b.d + step, trunkRun.length, Math.max(ahead, b.d))
        if (d > b.d) turning = true
        b.d = d
        if (!i && b.d >= trunkRun.length && tunnel.take(b.item, 0.3)) {
          // Over the lip and down into the hopper.
          trunkRun.at(b.d, spot)
          const [hx, hy, hz] = B.path[0]
          items.fly(b.item, { x: spot.at[0], y: spot.at[1] + 0.4, z: spot.at[2] }, { x: hx, y: hy + 0.6, z: hz }, 0.3)
          bursts.dust.spawn({ x: hx, y: hy + 1.4, z: hz, vy: 1.2, life: 0.7, size: 0.5, grow: 2.4, color: '#c9a878', opacity: 0.5 })
          riding.shift()
          i--
          continue
        }
        trunkRun.at(b.d, spot)
        items.add(b.item, spot.at[0], spot.at[1] + items.rest(b.item) / Math.cos(spot.pitch ?? 0), spot.at[2], spot.yaw, 1, spot.pitch)
      }
      moving = turning
      if (turning) tex.offset.y += step / B.cleatEvery
    },
  }
}
