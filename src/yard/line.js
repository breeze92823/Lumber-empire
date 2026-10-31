import { GAME, YARD } from '../config.js'
import { itemCode } from './items.js'

// The production lines, one per floor: runs of belts along GAME.line.path, measured in metres from
// the head (`s`). Logs wait in a pile at the head, ride the belts in single file (nothing moves
// closer than `gap` to the item ahead), pass through each machine one at a time and come out as
// its product. An item leaving a machine goes on along the conveyor if that machine's OUTPUT says
// NEXT and the belt to the next machine exists, otherwise it hops onto the machine's own pallet.
// Past the last machine NEXT means the Truck Conveyer, one belt up on stilts that all the floors
// share: an upper floor's items get to it down that floor's Truck Lifter.
const L = GAME.line

// Lengths along a polyline of points, and a walker that turns a distance back into a place.
export function polyline(points) {
  const legs = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const len = Math.hypot(...a.map((v, k) => b[k] - v))
    legs.push({ a, b, len, from: total })
    total += len
  }
  return {
    length: total,
    at(d, out) {
      const leg = legs.find((l) => d <= l.from + l.len) ?? legs[legs.length - 1]
      const k = (d - leg.from) / leg.len
      out.at = leg.a.map((v, i) => v + (leg.b[i] - v) * k)
      out.yaw = Math.atan2(leg.b[0] - leg.a[0], leg.b.at(-1) - leg.a.at(-1))
      if (leg.a.length > 2) out.pitch = -Math.asin((leg.b[1] - leg.a[1]) / leg.len)
      return out
    },
  }
}

const ground = polyline(L.path)
const upper = polyline(L.sky.path)
const trainRun = polyline(L.trainBelt)
const spot = { at: null, yaw: 0 }

// How far along the ground line a point on it lies.
function along(x, z) {
  let d = 0
  let best = Infinity
  let found = 0
  for (let i = 0; i < L.path.length - 1; i++) {
    const [ax, az] = L.path[i]
    const [bx, bz] = L.path[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (len * len)))
    const off = Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az))
    if (off < best) {
      best = off
      found = d + t * len
    }
    d += len
  }
  return found
}

// Long products keep further apart in a queue so they don't ride into each other.
export const room = (a, b) => Math.max(L.gap, GAME.products[a.kind].room ?? 0, GAME.products[b.kind].room ?? 0)

// Lines an item list up with the owner's numbers: a run of [item code, position in tenths, ...more]
// entries, `width` numbers each. An item that is near where it should be keeps moving and is
// drawn half way there, so a neighbour's belt doesn't jerk; anything else is simply put there.
function settle(run, flat, width, item, make, key, same) {
  const before = run.splice(0)
  for (let i = 0, n = 0; i + width <= flat.length; i += width, n++) {
    const at = flat[i + 1] / 10
    const old = before[n]
    const it = old && itemCodeMatches(old.item, flat[i]) && same.every((k, j) => old[k] === flat[i + 2 + j]) ? old : null
    if (it && Math.abs(it[key] - at) < NUDGE) {
      it[key] += (at - it[key]) / 2
      run.push(it)
      continue
    }
    const made = item(flat[i])
    if (made) run.push(make(at, made, flat.slice(i + 2, i + width)))
  }
}
const NUDGE = 2 // m
const itemCodeMatches = (a, code) => itemCode(a) === code

// The Truck Conveyer, and the branch off it to the Train Loader. The branch takes everything
// while a train stands at the chute. Otherwise the bays load in turn like a dock: every item is
// booked onto the truck being filled and, once that has all it can take, the next bay along, so
// no truck sits idle while a nearer one does the work. An item that can't be booked waits at the
// next bay on and holds up what is behind it.
export function createSky(items, trucks, train) {
  const belt = [] // furthest along first: { item, d, to }, to = the stop it is booked for
  const west = [] // the same on the branch
  const flat = L.sky.path.at(-2)
  const flatFrom = upper.length - (flat[2] - L.sky.path.at(-1)[2])
  const stops = trucks.list.map((t) => ({ t, d: flatFrom + (flat[2] - t.z) })).sort((a, b) => a.d - b.d)
  const junction = flatFrom + (flat[2] - L.trainBelt[0][2])
  let filling = 0 // the stop being loaded

  // The next stop in turn, from the one being loaded, that can take an item now at d.
  function book(d) {
    for (let n = 0; n < stops.length; n++) {
      const at = (filling + n) % stops.length
      const { t, d: there } = stops[at]
      if (there < d || !t.ready || t.room <= 0) continue
      filling = at
      t.booked++
      return stops[at]
    }
    return null
  }
  function release(b) {
    if (b.to) b.to.t.booked--
    b.to = null
  }

  const out = {
    boost: 1, // x2 Conveyer Speed
    // Whether truck t is spare for a Bay Conveyer. Finished goods pay far more, and a truck sent
    // off with cheap ones is a trip they can't have: so none may be waiting for a truck, and
    // another truck must be standing with room for the next one.
    spare: (t) => t.ready && t.room > 0 && belt.every((b) => b.to) && stops.some((s) => s.t !== t && s.t.ready && s.t.room > 0),
    // Puts an item on at d metres if nothing is too close. False if it has to wait.
    take(item, d = 0) {
      if (!belt.every((b) => Math.abs(b.d - d) >= room(item, b.item))) return false
      let at = 0
      while (at < belt.length && belt[at].d > d) at++
      belt.splice(at, 0, { item, d, to: null })
      return true
    },
    update(dt) {
      const step = L.speed * out.boost * dt
      const toTrain = train.accepting
      for (let i = 0; i < belt.length; i++) {
        const b = belt[i]
        const branch = toTrain && b.d <= junction
        if (branch || !b.to?.t.ready) release(b)
        if (!branch && !b.to) b.to = book(b.d)
        const stop = b.to ?? stops.find((s) => s.d >= b.d) ?? stops[stops.length - 1]
        const end = branch ? junction : stop.d
        const ahead = i > 0 ? belt[i - 1].d - room(b.item, belt[i - 1].item) : Infinity
        b.d = Math.min(b.d + step, end, Math.max(ahead, b.d))
        if (b.d < end) continue
        if (branch) {
          if (west.length && west[west.length - 1].d < room(b.item, west[west.length - 1].item)) continue
          west.push({ item: b.item, d: 0 })
          belt.splice(i, 1)
          i--
        } else if (b.to) {
          release(b)
          upper.at(b.d, spot)
          trucks.sell(b.item, stop.t, { x: spot.at[0], y: spot.at[1] + 0.5, z: spot.at[2] })
          belt.splice(i, 1)
          i--
        }
      }
      for (let i = 0; i < west.length; i++) {
        const b = west[i]
        const ahead = i > 0 ? west[i - 1].d - room(b.item, west[i - 1].item) : Infinity
        b.d = Math.min(b.d + step, trainRun.length, Math.max(ahead, b.d))
        if (b.d < trainRun.length || !train.accepting) continue
        trainRun.at(b.d, spot)
        train.load(b.item, { x: spot.at[0], y: spot.at[1] + 0.5, z: spot.at[2] })
        west.splice(i, 1)
        i--
      }
      for (const b of belt) {
        upper.at(b.d, spot)
        items.add(b.item, spot.at[0], spot.at[1] + items.rest(b.item), spot.at[2], spot.yaw)
      }
      for (const b of west) {
        trainRun.at(b.d, spot)
        items.add(b.item, spot.at[0], spot.at[1] + items.rest(b.item), spot.at[2], spot.yaw)
      }
    },
    // [[item code, d in tenths, ...] on the belt, the same on the branch].
    snapshot(code) {
      const list = (run) => run.flatMap((b) => [code(b.item), Math.round(b.d * 10)])
      return [list(belt), list(west)]
    },
    restore([main, branch], item) {
      for (const b of belt) release(b)
      settle(belt, main, 2, item, (at, it) => ({ item: it, d: at, to: null }), 'd', [])
      settle(west, branch, 2, item, (at, it) => ({ item: it, d: at }), 'd', [])
    },
    reset() {
      belt.length = west.length = 0
      filling = 0
      out.boost = 1
    },
  }
  return out
}

export function createLine(items, sky, floor = 0) {
  const base = YARD.floors.y * floor // height of this floor
  const lift = floor ? polyline(L.truckLift.map(([x, h, z]) => [x, h === null ? L.beltY + base : h, z])) : null
  const stages = L.machines.map((m, i) => ({
    ...m,
    x: m.x ?? L.x,
    index: i,
    floor,
    base,
    s: along(m.x ?? L.x, m.z),
    owned: false,
    linked: false, // the conveyor from here on is built
    workers: true, // WORKERS sign: the crew serves this machine
    next: true, // OUTPUT sign: on along the conveyor, or PALLET
    speed: 1,
    turbo: false, // the Debarker Turbo is bought
    lift: null, // the step lifter at the end of its outgoing belt, once bought
    feed: null, // the Bay Conveyer that starts at the end of its outgoing belt, once bought
    inside: null, // the item in the machine
    progress: 0,
    pallet: m.dock,
    stock: [], // items on the pallet
    incoming: 0, // items in the air on their way to it
    get busy() {
      return !!this.inside
    },
  }))
  // Where hand-carried goods go on a machine's incoming belt, and where a worker stands to do it.
  for (const m of stages) {
    const s = m.s - m.mouth - L.handIn
    ground.at(s, spot)
    const [x, z] = spot.at
    m.inlet = { s, x, z, standX: x - Math.cos(spot.yaw) * L.handStand, standZ: z + Math.sin(spot.yaw) * L.handStand }
  }
  const belt = [] // furthest along first: { item, s, stage, leaving }
  const down = [] // on the Truck Lifter: { item, d }
  const pile = []
  let inbound = 0 // logs in the air on their way to the pile
  let handing = false // an item is in the air on its way to a belt, by hand

  const y = (item) => base + L.beltY + items.rest(item)
  const free = (s, item) => belt.every((b) => Math.abs(b.s - s) >= room(item, b.item))
  // Only what is ahead counts here: an item waiting to go in must not stop the one coming out.
  const clearAhead = (s, item) => belt.every((b) => b.s <= s || b.s - s >= room(item, b.item))
  const put = (at, item) => ground.at(at, spot) && [spot.at[0], y(item), spot.at[1]]

  function leaveMachine(m) {
    const s = m.s + m.mouth
    if (!clearAhead(s, m.inside)) return
    let at = 0
    while (at < belt.length && belt[at].s > s) at++
    belt.splice(at, 0, { item: m.inside, s, stage: m.index, leaving: true })
    m.inside = null
    m.progress = 0
  }

  // Off the end of the last belt: onto the Truck Conveyer, or down this floor's Truck Lifter.
  function ship(item) {
    if (!lift) return sky.take(item)
    if (down.length && down[down.length - 1].d < room(item, down[down.length - 1].item)) return false
    down.push({ item, d: 0 })
    return true
  }

  function moveBelt(dt) {
    const step = L.speed * sky.boost * dt
    for (let i = 0; i < belt.length; i++) {
      const b = belt[i]
      const m = stages[b.stage]
      const end = b.leaving ? m.s + m.belt : m.s - m.mouth
      const ahead = i > 0 ? belt[i - 1].s - room(b.item, belt[i - 1].item) : Infinity
      b.s = Math.min(b.s + step, end, Math.max(ahead, b.s))
      if (b.s < end) continue
      if (!b.leaving) {
        if (m.inside) continue
        m.inside = b.item
        m.progress = 0
      } else {
        const lifted = !b.lifted && m.next && m.lift?.take(out, m, b.item)
        if (lifted === 'wait') continue
        if (lifted) {
          belt.splice(i, 1)
          i--
          continue
        }
        const onward = stages[b.stage + 1]
        if (m.next && m.linked && onward?.owned) {
          if (m.feed?.take(b.item)) {
            belt.splice(i, 1)
            i--
            continue
          }
          b.stage++
          b.leaving = false
          continue
        }
        if (m.next && m.linked && !onward) {
          if (!ship(b.item)) continue
        } else {
          if (m.stock.length + m.incoming >= L.dockMax) continue
          m.incoming++
          const [x, h, z] = put(b.s, b.item)
          items.fly(b.item, { x, y: h, z }, { x: m.pallet.x, y: base + 0.6, z: m.pallet.z }, 0.45, (item) => {
            m.incoming--
            m.stock.push(item)
          })
        }
      }
      belt.splice(i, 1)
      i--
    }
  }

  function moveLift(dt) {
    const step = L.speed * sky.boost * dt
    for (let i = 0; i < down.length; i++) {
      const b = down[i]
      const ahead = i > 0 ? down[i - 1].d - room(b.item, down[i - 1].item) : Infinity
      b.d = Math.min(b.d + step, lift.length, Math.max(ahead, b.d))
      if (b.d < lift.length || !sky.take(b.item, L.liftJoin)) continue
      down.splice(i, 1)
      i--
    }
  }

  function draw() {
    for (const b of belt) {
      ground.at(b.s, spot)
      items.add(b.item, spot.at[0], y(b.item), spot.at[1], spot.yaw)
    }
    for (const b of down) {
      lift.at(b.d, spot)
      items.add(b.item, spot.at[0], spot.at[1] + items.rest(b.item), spot.at[2], spot.yaw)
    }
    pile.forEach((item, i) => items.stack(item, i, L.feed.x, base + 0.05, L.feed.z, Math.PI / 2, 0.8))
    for (const m of stages) {
      if (m.inside) {
        ground.at(m.s - m.mouth + 2 * m.mouth * m.progress, spot)
        items.add(m.inside, spot.at[0], y(m.inside), spot.at[1], spot.yaw)
      }
      m.stock.forEach((item, i) => items.stack(item, i, m.pallet.x, base + 0.16, m.pallet.z, 0, 0.8))
    }
  }

  const out = {
    stages,
    pile,
    floor,
    base,
    holdLogs: null, // says when the head of this pile is meant for another floor
    fed: 0, // logs that have left the pile for the belt
    // What stage i has to get through: inside it, on the belts to it and, at the head, the pile.
    queued(i) {
      let n = stages[i].inside ? 1 : 0
      for (const b of belt) if (b.leaving ? b.stage === i - 1 : b.stage === i) n++
      return i ? n : n + pile.length + inbound
    },
    // Whether stage i has a belt on to a working stage i + 1.
    runs: (i) => stages[i].linked && !!stages[i + 1]?.owned,
    // Goods carried by hand from stage i - 1, with no conveyor between. False if the belt's full.
    handIn(i, item, from) {
      const { s, x, z } = stages[i].inlet
      if (handing || !free(s, item)) return false
      handing = true
      items.fly(item, from, { x, y: y(item), z }, 0.3, () => {
        handing = false
        let at = 0
        while (at < belt.length && belt[at].s > s) at++
        belt.splice(at, 0, { item, s, stage: i, leaving: false })
      })
      return true
    },
    // A step lifter puts an item back on a belt, at the end of stage i's. False if there's no room.
    enter(i, item, from) {
      const m = stages[i]
      const s = m.s + m.belt
      if (!free(s, item)) return false
      const [x, h, z] = put(s, item)
      items.fly(item, from, { x, y: h, z }, 0.3, () => {
        let at = 0
        while (at < belt.length && belt[at].s > s) at++
        belt.splice(at, 0, { item, s, stage: i, leaving: true, lifted: true })
      })
      return true
    },
    get roomForLogs() {
      return L.pileMax - pile.length - inbound
    },
    // A log thrown from (x, y, z) onto the pile. False if the pile is full.
    feed(item, from) {
      if (this.roomForLogs <= 0) return false
      inbound++
      items.fly(item, from, { x: L.feed.x, y: base + 0.6, z: L.feed.z }, 0.4, () => {
        inbound--
        pile.push(item)
      })
      return true
    },
    get anything() {
      return pile.length > 0 || inbound > 0 || belt.length > 0 || stages.some((m) => m.inside || m.stock.length || m.incoming)
    },
    get moving() {
      return belt.length > 0
    },
    // The floor as numbers: [belt: [item code, s in tenths, stage, leaving?, ...], Truck Lifter: [item
    // code, d in tenths, ...], pile: [item code, ...], each machine: [inside item code or -1, progress
    // in hundredths, [pallet item code, ...]]].
    snapshot(code) {
      return [
        belt.flatMap((b) => [code(b.item), Math.round(b.s * 10), b.stage, b.leaving ? 1 : 0]),
        down.flatMap((b) => [code(b.item), Math.round(b.d * 10)]),
        pile.map(code),
        stages.map((m) => [m.inside ? code(m.inside) : -1, Math.round(m.progress * 100), m.stock.map(code)]),
      ]
    },
    restore([run, lifting, heap, machines], item) {
      settle(belt, run, 4, item, (at, it, [stage, leaving]) => ({ item: it, s: at, stage, leaving: !!leaving }), 's', ['stage'])
      settle(down, lifting, 2, item, (at, it) => ({ item: it, d: at }), 'd', [])
      const fill = (list, codes) => {
        if (list.length === codes.length) return
        list.length = 0
        for (const c of codes) {
          const it = item(c)
          if (it) list.push(it)
        }
      }
      fill(pile, heap)
      machines.forEach(([inside, progress, stock], i) => {
        const m = stages[i]
        if (!m) return
        m.inside = inside < 0 ? null : (m.inside ?? item(inside))
        m.progress = progress / 100
        fill(m.stock, stock)
      })
    },
    // Back to a bare floor: nothing on the belts, nothing bought. Call items.clear() too.
    reset() {
      belt.length = down.length = pile.length = 0
      inbound = 0
      handing = false
      out.fed = 0
      for (const m of stages) {
        m.owned = false
        m.linked = false
        m.workers = m.next = true
        m.speed = 1
        m.turbo = false
        m.lift = null
        m.feed = null
        m.sign = L.machines[m.index].sign
        m.inside = null
        m.progress = 0
        m.stock.length = 0
        m.incoming = 0
        m.out = L.machines[m.index].out
      }
    },
    update(dt) {
      if (pile.length && free(0, pile[0]) && !out.holdLogs?.()) {
        belt.push({ item: pile.shift(), s: 0, stage: 0, leaving: false })
        out.fed++
      }
      for (const m of stages) {
        if (!m.inside) continue
        if (m.progress < 1) {
          m.progress = Math.min(1, m.progress + (dt * m.speed * sky.boost) / m.time)
          if (m.progress >= 0.5 && m.inside.kind !== m.out) m.inside.kind = m.out
        }
        if (m.progress >= 1) leaveMachine(m)
      }
      moveBelt(dt)
      if (lift) moveLift(dt)
      draw()
    },
  }
  return out
}
