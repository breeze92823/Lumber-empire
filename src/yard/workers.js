import { Group } from 'three'
import { GAME, YARD } from '../config.js'
import { label } from '../propkit.js'
import { box, matte } from './kit.js'

// Blocky hired hands. Each one works out its next job when it has none: fell the nearest
// free tree, gather logs and tip them on the pile at LOGS IN, or haul a pallet to a truck. The
// machines' WORKERS signs say which pallets they may touch; the Debarker's also rules the logs.
// Limbs hang from pivots at the shoulder and hip so swinging them reads as a walk.
const { crew: C, line: L } = GAME
const SELLS = YARD.rings.filter((r) => r.sell != null)

function limb(mat, w, h, x, y) {
  const pivot = new Group()
  pivot.position.set(x, y, 0)
  box(pivot, mat, w, h, w, 0, -h / 2, 0).castShadow = true
  return pivot
}

function buildWorker() {
  const W = YARD.workers
  const g = new Group()
  const body = new Group()
  g.add(body)
  const shirt = matte(W.shirt)
  const skin = matte(W.skin)
  const arm = matte(W.arm)
  const pants = matte(W.pants)

  box(body, shirt, 0.82, 0.8, 0.42, 0, 1.25, 0).castShadow = true
  box(body, skin, 0.46, 0.46, 0.46, 0, 1.9, 0).castShadow = true
  box(body, matte(W.shoes), 0.1, 0.07, 0.02, -0.12, 1.96, 0.235)
  box(body, matte(W.shoes), 0.1, 0.07, 0.02, 0.12, 1.96, 0.235)
  // The hard hat.
  box(body, matte(W.hat), 0.56, 0.2, 0.56, 0, 2.22, 0).castShadow = true
  box(body, matte(W.hat), 0.7, 0.06, 0.7, 0, 2.13, 0.02)

  const armL = limb(arm, 0.32, 0.8, -0.58, 1.6)
  const armR = limb(arm, 0.32, 0.8, 0.58, 1.6)
  const legL = limb(pants, 0.38, 0.82, -0.2, 0.86)
  const legR = limb(pants, 0.38, 0.82, 0.2, 0.86)
  for (const leg of [legL, legR]) box(leg, matte(W.shoes), 0.4, 0.14, 0.46, 0, -0.78, 0.04).castShadow = true
  body.add(armL, armR, legL, legR)

  // The axe rides the right hand.
  const axe = new Group()
  box(axe, matte(W.axe.handle), 0.11, 1.15, 0.11, 0, -0.12, 0).castShadow = true
  box(axe, matte(W.axe.head), 0.09, 0.42, 0.52, 0, 0.32, 0.2).castShadow = true
  axe.position.set(0, -0.78, 0.2)
  axe.rotation.x = Math.PI / 2.3
  armR.add(axe)

  const tag = label(W.tag, 0.42, { color: '#ebebeb', outline: '#3f4048', outlineWidth: 8 })
  tag.position.set(0, 2.75, 0)
  g.add(tag)
  return { g, armL, armR, legL, legR, axe }
}

// The walk: legs swinging, arms too until they carry something.
function stride(w, elapsed, carrying) {
  const s = Math.sin((elapsed + w.phase) * 9.5) * 0.75
  w.legL.rotation.x = s
  w.legR.rotation.x = -s
  w.armL.rotation.x = carrying ? -1.3 : -s
  w.armR.rotation.x = carrying ? -1.3 : s
  w.axe.visible = !carrying
}

// Wind up slowly, strike fast: asymmetric sine on the axe arm.
function chop(w, elapsed) {
  const c = (elapsed / C.hitEvery + w.phase) % 1
  w.armR.rotation.x = c < 0.72 ? -2.5 * (c / 0.72) : -2.5 + 2.8 * ((c - 0.72) / 0.28)
  w.armL.rotation.x = w.armR.rotation.x * 0.5
  w.legL.rotation.x = -0.2
  w.legR.rotation.x = 0.2
  w.axe.visible = true
}

function rest(w) {
  for (const l of [w.legL, w.legR, w.armL, w.armR]) l.rotation.x *= 0.8
}

// What it carries, stacked in front of it.
function drawLoad(w, items, kind, count) {
  const yaw = w.g.rotation.y
  const fx = Math.sin(yaw) * 0.7
  const fz = Math.cos(yaw) * 0.7
  for (let i = 0; i < count; i++) {
    const item = kind[i] ?? kind[0]
    items.add(item, w.g.position.x + fx, w.g.position.y + 1.2 + i * items.rest(item) * 1.5, w.g.position.z + fz, yaw + Math.PI / 2, 0.68)
  }
}

// A neighbour's crew: no minds of their own, each walks to where the owner last said it was and
// does what it was doing there. pose: [x, y, z in tenths, yaw in hundredths, chopping?, load's item
// code or -1, load count].
export const CREW_FIELDS = 7
export function buildPuppets(scene, { items, forest }, item) {
  const crew = []
  const FOLLOW = 7 // 1/s: how quickly one closes on its last known spot

  function hire(index) {
    const w = buildWorker()
    w.g.visible = false
    scene.add(w.g)
    crew.push(Object.assign(w, { index, job: null, phase: index * 1.7, beat: index * 0.5, load: [], count: 0, code: -1, chopping: false, placed: false, to: { x: 0, y: 0, z: 0, yaw: 0 } }))
  }

  return {
    crew,
    setCount(n) {
      while (crew.length < n) hire(crew.length)
      crew.forEach((w, i) => {
        w.g.visible = i < n
        if (!w.g.visible) w.placed = false
      })
    },
    clear() {
      for (const w of crew) {
        w.count = 0
        w.chopping = false
      }
    },
    restore(flat) {
      const n = Math.floor(flat.length / CREW_FIELDS)
      this.setCount(n)
      for (let i = 0; i < n; i++) {
        const w = crew[i]
        const at = i * CREW_FIELDS
        w.to.x = flat[at] / 10
        w.to.y = flat[at + 1] / 10
        w.to.z = flat[at + 2] / 10
        w.to.yaw = flat[at + 3] / 100
        w.chopping = !!flat[at + 4]
        if (w.code !== flat[at + 5]) {
          w.code = flat[at + 5]
          const it = w.code < 0 ? null : item(w.code)
          w.load = it ? [it] : []
        }
        w.count = w.load.length ? flat[at + 6] : 0
        if (!w.placed) {
          w.placed = true
          w.g.position.set(w.to.x, w.to.y, w.to.z)
          w.g.rotation.y = w.to.yaw
        }
      }
    },
    update(dt, elapsed) {
      const k = 1 - Math.exp(-FOLLOW * dt)
      for (const w of crew) {
        if (!w.g.visible) continue
        const p = w.g.position
        const dx = w.to.x - p.x
        const dz = w.to.z - p.z
        const away = Math.hypot(dx, dz)
        if (away > 20) p.set(w.to.x, w.to.y, w.to.z)
        p.x += dx * k
        p.y += (w.to.y - p.y) * k
        p.z += dz * k
        w.g.rotation.y += Math.atan2(Math.sin(w.to.yaw - w.g.rotation.y), Math.cos(w.to.yaw - w.g.rotation.y)) * Math.min(1, k * 2)
        if (away > 0.12) stride(w, elapsed, w.count > 0)
        else if (w.chopping) {
          chop(w, elapsed)
          w.beat -= dt
          if (w.beat <= 0) {
            w.beat = C.hitEvery
            const t = forest.near(p.x, p.z, 3)
            if (t) forest.shake(t)
          }
        } else {
          rest(w)
          w.axe.visible = w.count === 0
        }
        if (w.count) drawLoad(w, items, w.load, w.count)
      }
    },
  }
}

export function buildWorkers(scene, { forest, lines, trucks, train, items }, stats) {
  const W = YARD.workers
  const [line] = lines
  const stages = lines.flatMap((l) => l.stages)
  const [debarker] = stages
  const F = YARD.floors
  const TRAIN_RING = YARD.rings.find((r) => r.text === 'TRAIN')
  const crew = []

  // Straight there, unless that means crossing the line: then round its north end.
  function routeTo(w, x, z, floor = 0) {
    const here = Math.round(w.g.position.y / F.y)
    w.path = []
    // Up or down the stairs, floor by floor; [x, z, height], and heights left out stay put.
    for (let f = here; f < floor; f++) for (const [px, pz] of F.route[f]) w.path.push([px, pz, f * F.y + (pz === F.route[f][0][1] ? 0 : F.y)])
    for (let f = here - 1; f >= floor; f--) for (const [px, pz] of [...F.route[f]].reverse()) w.path.push([px, pz, f * F.y + (pz === F.route[f][0][1] ? 0 : F.y)])
    if (floor) {
      w.path.push([x, z, floor * F.y])
      return
    }
    const last = w.path.at(-1)
    const from = last ? { x: last[0], z: last[1] } : w.g.position
    const [east, west] = C.passage
    const fromEast = from.x > L.x
    const toEast = x > L.x
    if (fromEast !== toEast && (from.z > east[1] || z > east[1])) w.path.push(fromEast ? east : west, fromEast ? west : east)
    else if (fromEast && z < east[1] + 1 && from.z > east[1]) w.path.push(east)
    w.path.push([x, z])
  }

  // Pallets with something left on them once the others' shares are taken: the furthest along
  // the process first, it's the nearest to being sold, then the closest.
  function palletToHaul(w) {
    let best = null
    let bestD = Infinity
    for (const s of stages) {
      if (!s.workers || !s.owned) continue
      const taken = crew.reduce((n, o) => n + (o !== w && o.job === 'haul' && o.stage === s ? stats.workerCarry : 0), 0)
      if (s.stock.length <= taken) continue
      const d = Math.hypot(s.pallet.x - w.g.position.x, s.pallet.z - w.g.position.z) - s.index * 1000
      if (d < bestD) {
        best = s
        bestD = d
      }
    }
    return best
  }

  // The next machine a pallet's goods can be carried to, if nothing else takes them there.
  function carryOn(s) {
    const next = lines[s.floor].stages[s.index + 1]
    return next?.owned && next.workers && !s.linked ? next : null
  }

  function goFeed(w) {
    w.job = 'feed'
    routeTo(w, w.next.inlet.standX, w.next.inlet.standZ, w.next.floor)
  }

  function goSell(w) {
    w.job = 'sell'
    if (train.accepting) {
      w.truck = train
      routeTo(w, TRAIN_RING.x, TRAIN_RING.z + (w.index - 1) * C.standTruck)
      return
    }
    // The nearest truck that is in, or the nearest of all if they're all out.
    const owned = SELLS.filter((r) => trucks.list[r.sell].owned)
    const open = owned.filter((r) => trucks.list[r.sell].ready)
    const ring = (open.length ? open : owned).sort((a, b) => Math.hypot(a.x - w.g.position.x, a.z - w.g.position.z) - Math.hypot(b.x - w.g.position.x, b.z - w.g.position.z))[0]
    w.truck = trucks.list[ring.sell]
    routeTo(w, ring.x, ring.z + (w.index - 1) * C.standTruck)
  }

  function goLoad(w) {
    w.job = 'load'
    routeTo(w, L.feedStand.x, L.feedStand.z)
  }

  const JOBS = {
    haul(w) {
      const s = palletToHaul(w)
      if (!s) return false
      w.job = 'haul'
      w.stage = s
      routeTo(w, s.pallet.x - 1.2, s.pallet.z - 1.7, s.floor)
      return true
    },
    logs(w) {
      if (!debarker.workers || line.roomForLogs <= 0) return false
      const log = forest.nearestLog(w.g.position.x, w.g.position.z)
      if (!log) return false
      log.claim = w
      w.log = log
      w.job = 'pick'
      routeTo(w, log.x, log.z)
      return true
    },
    fell(w) {
      if (!debarker.workers || forest.ground.length >= GAME.maxGroundLogs / 2) return false
      const t = forest.freeTree(w.g.position.x, w.g.position.z)
      if (!t) return false
      t.claim = w
      w.tree = t
      w.job = 'fell'
      const d = Math.hypot(t.x - w.g.position.x, t.z - w.g.position.z) || 1
      const stand = 0.75 * t.scale + C.stand
      routeTo(w, t.x + ((w.g.position.x - t.x) / d) * stand, t.z + ((w.g.position.z - t.z) / d) * stand)
      return true
    },
  }

  function think(w) {
    if (w.next?.owned && w.load.length) return goFeed(w)
    if (w.load.length) return debarker.owned && w.load[0].kind === 'log' ? goLoad(w) : goSell(w)
    // A full pallet stops the line behind it, so then everyone hauls.
    const hauler = w.index % C.haulEvery === C.haulEvery - 1 || stages.some((s) => s.stock.length >= L.dockMax)
    const order = hauler ? ['haul', 'logs', 'fell'] : ['logs', 'fell', 'haul']
    if (order.some((job) => JOBS[job](w))) return undefined
    if (w.job === 'wait') return undefined
    w.job = 'wait'
    routeTo(w, W.spawn[0] + w.index * 1.6, W.spawn[1])
    return undefined
  }

  function hire() {
    const w = buildWorker()
    const index = crew.length
    w.g.position.set(W.spawn[0] + index * 1.6, 0, W.spawn[1])
    scene.add(w.g)
    crew.push(Object.assign(w, { index, job: null, path: [], load: [], beat: index * 0.5, phase: index * 1.7, tree: null, log: null, stage: null, next: null, truck: null, stepping: 0 }))
  }

  // Along the path; true on arrival.
  function walk(w, dt, elapsed) {
    if (!w.path.length) return true
    const [tx, tz, ty = w.g.position.y] = w.path[0]
    const dx = tx - w.g.position.x
    const dz = tz - w.g.position.z
    const dist = Math.hypot(dx, dz)
    const step = stats.workerSpeed * GAME.workerSpeedPerPoint * dt
    if (dist <= step) {
      w.g.position.x = tx
      w.g.position.z = tz
      w.g.position.y = ty
      w.path.shift()
      return !w.path.length
    }
    w.g.position.x += (dx / dist) * step
    w.g.position.z += (dz / dist) * step
    w.g.position.y += ((ty - w.g.position.y) * step) / dist
    w.g.rotation.y = Math.atan2(dx, dz)
    stride(w, elapsed, w.load.length > 0)
    return false
  }

  const STEP = {
    fell(w, dt, elapsed) {
      const t = w.tree
      if (t.state !== 'up') {
        w.job = null
        return
      }
      w.g.rotation.y = Math.atan2(t.x - w.g.position.x, t.z - w.g.position.z)
      chop(w, elapsed)
      w.beat -= dt
      if (w.beat <= 0) {
        w.beat = C.hitEvery
        forest.hit(t, stats.workerAxe, w.g.position.x, w.g.position.z)
      }
    },
    pick(w) {
      const log = w.log
      w.log = null
      if (forest.ground.includes(log)) w.load.push(forest.takeLog(log))
      if (w.load.length < stats.workerCarry) {
        const next = forest.nearestLog(w.g.position.x, w.g.position.z, C.pickRange)
        if (next) {
          next.claim = w
          w.log = next
          routeTo(w, next.x, next.z)
          return
        }
      }
      w.job = null
    },
    load(w, dt) {
      rest(w)
      w.beat -= dt
      if (w.beat > 0) return
      w.beat = C.tipEvery
      const item = w.load[w.load.length - 1]
      if (!line.feed(item, { x: w.g.position.x, y: 1.3, z: w.g.position.z })) return
      w.load.pop()
      if (!w.load.length) w.job = null
    },
    haul(w) {
      const s = w.stage
      while (s.stock.length && w.load.length < stats.workerCarry) w.load.push(s.stock.pop())
      w.next = carryOn(s)
      w.job = null
    },
    feed(w, dt) {
      rest(w)
      w.beat -= dt
      if (w.beat > 0) return
      w.beat = C.tipEvery
      const item = w.load[w.load.length - 1]
      if (!lines[w.next.floor].handIn(w.next.index, item, { x: w.g.position.x, y: w.g.position.y + 1.3, z: w.g.position.z })) return
      w.load.pop()
      if (!w.load.length) {
        w.next = null
        w.job = null
      }
    },
    sell(w, dt) {
      rest(w)
      w.beat -= dt
      if (w.truck === train && !train.accepting) {
        w.job = null
        return
      }
      if (w.beat > 0 || !w.truck.ready) return
      w.beat = C.tipEvery
      const from = { x: w.g.position.x, y: 1.3, z: w.g.position.z }
      if (w.truck === train) train.load(w.load.pop(), from)
      else trucks.sell(w.load.pop(), w.truck, from)
      if (!w.load.length) w.job = null
    },
    wait(w) {
      rest(w)
      w.axe.visible = true
    },
  }

  return {
    crew,
    pace: 1, // Rush Hour
    setCount(n) {
      while (crew.length < n) hire()
    },
    // The crew as buildPuppets' pose numbers.
    snapshot(code) {
      return crew.flatMap((w) => {
        const p = w.g.position
        return [
          Math.round(p.x * 10),
          Math.round(p.y * 10),
          Math.round(p.z * 10),
          Math.round(w.g.rotation.y * 100),
          w.job === 'fell' && !w.path.length ? 1 : 0,
          w.load.length ? code(w.load[0]) : -1,
          w.load.length,
        ]
      })
    },
    // Rebirth: empty hands and no job, whatever they were doing.
    clear() {
      for (const w of crew) {
        w.load.length = 0
        w.path = []
        w.g.position.y = 0 // the floors have gone from under them
        w.job = w.tree = w.log = w.stage = w.next = w.truck = null
      }
    },
    update(dt, elapsed) {
      dt *= this.pace
      for (const w of crew) {
        // Pickups can vanish: a log rots, a tree is felled by someone else.
        if (w.job === 'pick' && !forest.ground.includes(w.log)) w.job = null
        if (w.job === 'fell' && w.tree?.state !== 'up') w.job = null
        if (!w.job || w.job === 'wait') think(w)
        if (walk(w, dt, elapsed)) STEP[w.job]?.(w, dt, elapsed)
        if (w.tree && w.job !== 'fell') {
          if (w.tree.claim === w) w.tree.claim = null
          w.tree = null
        }
        drawLoad(w, items, w.load, w.load.length)
      }
    },
  }
}
