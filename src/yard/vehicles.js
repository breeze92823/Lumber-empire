import { CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial } from 'three'
import { airBrake, horn, reverseBeep } from '../audio/sfx.js'
import { GAME, WINDOWS, YARD } from '../config.js'
import { neon } from '../propkit.js'
import { paintSoftDot } from '../textures.js'
import { bar, box, matte, place, silhouette } from './kit.js'
import { paintLoadTag, paintLuckyTag } from './paint.js'
import { createRig, trace, travelTime } from './rig.js'
import { rigShowpiece, rigTemplate } from './rigModels.js'

// The trucks and the train. Models are built nose-to-+Z with the floor at y = 0.
const SOUND = { horn, air: airBrake, beep: reverseBeep }
const TRAIN_STATES = ['pass', 'in', 'dock', 'out']

function wheel(g, x, z, r, width, hub) {
  const y = r
  bar(g, matte('#15161c'), r, width, x, y, z, 'x', 18)
  bar(g, matte(hub), r * 0.5, width + 0.06, x, y, z, 'x', 12)
  bar(g, matte('#262832'), r * 0.2, width + 0.12, x, y, z, 'x', 8)
}

function axle(g, z, r, halfTrack, width, hub) {
  wheel(g, -halfTrack, z, r, width, hub)
  wheel(g, halfTrack, z, r, width, hub)
  bar(g, matte('#23252e'), 0.14, halfTrack * 2, 0, r, z, 'x', 8)
}

// The locked trucks' silhouette: a stepped cab with a dump bed and three axles.
function buildOwnedTruck() {
  const T = YARD.ownedTruck
  const g = new Group()
  const paint = matte(T.color)
  const trim = matte(T.trim)
  const black = matte('#16171d')
  const glass = matte(T.glass, { roughness: 0.25, metalness: 0.1 })
  const W = 3.2
  const hub = T.trim

  // Chassis.
  box(g, black, 2.2, 0.32, 7.6, 0, 1.02, 0)
  axle(g, 2.6, 0.78, 1.32, 0.62, hub)
  axle(g, -1.65, 0.78, 1.32, 0.62, hub)
  axle(g, -3.1, 0.78, 1.32, 0.62, hub)
  box(g, black, W + 0.1, 0.34, 0.34, 0, 1.0, 4.02) // front bumper
  box(g, matte('#c8ccd3'), 0.5, 0.5, 0.1, -W / 2 - 0.26, 2.6, 3.0) // mirrors
  box(g, black, 0.08, 0.7, 0.08, -W / 2 - 0.1, 2.6, 3.05)
  box(g, matte('#c8ccd3'), 0.5, 0.5, 0.1, W / 2 + 0.26, 2.6, 3.0)
  box(g, black, 0.08, 0.7, 0.08, W / 2 + 0.1, 2.6, 3.05)

  // Cab: lower block, stepped upper block, sloped roof slab.
  box(g, paint, W, 1.5, 3, 0, 1.92, 2.45)
  box(g, paint, W, 1.3, 2.3, 0, 3.26, 2.1)
  box(g, trim, W + 0.04, 0.09, 3.04, 0, 2.66, 2.45)
  box(g, matte('#f2c22c'), W - 0.1, 0.34, 2.3, 0, 4.04, 2.1)
  box(g, trim, W + 0.04, 0.08, 2.34, 0, 3.86, 2.1)
  // Glass: windscreen plus the two side windows.
  box(g, glass, W - 0.5, 0.96, 0.08, 0, 3.26, 3.27)
  for (const x of [-W / 2 - 0.02, W / 2 + 0.02]) box(g, glass, 0.06, 0.92, 1.1, x, 3.28, 2.5)
  for (const x of [-1.15, 1.15]) box(g, matte('#f6e7a0'), 0.56, 0.3, 0.06, x, 1.9, 3.97) // lamps
  box(g, trim, 1.2, 0.5, 0.05, 0, 1.9, 3.97)

  // Cab-to-bed step and the bed.
  box(g, paint, W, 1.1, 0.7, 0, 2.15, 0.65)
  const bedL = 4.3
  const floorZ = -1.45
  box(g, trim, W, 0.22, bedL, 0, 1.3, floorZ)
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) {
    box(g, paint, 0.2, 1.05, bedL, x, 1.9, floorZ)
    box(g, trim, 0.24, 0.07, bedL, x, 2.1, floorZ)
    box(g, trim, 0.24, 0.07, bedL, x, 1.72, floorZ)
  }
  box(g, paint, W, 1.05, 0.2, 0, 1.9, floorZ - bedL / 2)
  box(g, trim, W + 0.04, 0.07, 0.24, 0, 2.1, floorZ - bedL / 2)
  box(g, trim, W + 0.04, 0.07, 0.24, 0, 1.72, floorZ - bedL / 2)
  for (const x of [-1.42, 1.42]) box(g, neon('#ff2a2a', 1.8), 0.34, 0.2, 0.06, x, 1.34, floorZ - bedL / 2 - 0.14) // tail lights
  // The load: a couple of pale cut boards.
  box(g, matte('#e6d2ab'), 2.1, 0.5, 2.1, 0.1, 1.68, -1.3, 0.3)
  box(g, matte('#d1b98d'), 1.9, 0.26, 1.6, -0.1, 2.05, -1.1, -0.2)
  return g
}

// --- Train ------------------------------------------------------------------------
function buildLocomotive() {
  const T = YARD.train
  const g = new Group()
  const body = matte(T.body)
  const boiler = matte(T.boiler)
  const trim = matte(T.trim)
  const red = matte(T.cab)
  box(g, body, 2.5, 0.5, 12, 0, 0.95, 0)
  for (let i = 0; i < 4; i++) {
    for (const x of [-1.1, 1.1]) {
      bar(g, red, 0.8, 0.18, x, 0.8, 3.4 - i * 2.2, 'x', 16)
      bar(g, trim, 0.25, 0.24, x, 0.8, 3.4 - i * 2.2, 'x', 8)
    }
  }
  box(g, trim, 0.1, 0.1, 6.6, -1.22, 0.8, 0.1)
  box(g, trim, 0.1, 0.1, 6.6, 1.22, 0.8, 0.1)
  bar(g, boiler, 1.25, 7.2, 0, 2.4, 1.9, 'z', 16)
  for (const z of [-0.6, 1.6, 3.8]) bar(g, trim, 1.3, 0.16, 0, 2.4, z, 'z', 16)
  bar(g, boiler, 1.3, 0.3, 0, 2.4, 5.6, 'z', 16)
  bar(g, body, 0.48, 1.7, 0, 4.2, 4.4, 'y', 12) // stack
  bar(g, trim, 0.62, 0.22, 0, 5.1, 4.4, 'y', 12)
  bar(g, trim, 0.55, 0.7, 0, 3.9, 1.2, 'y', 12) // dome
  box(g, neon('#fff2c0', 4), 0.7, 0.5, 0.2, 0, 3.05, 5.82) // headlamp
  box(g, red, 3, 3.3, 3.2, 0, 2.9, -3.5)
  box(g, body, 3.4, 0.26, 3.8, 0, 4.66, -3.5)
  box(g, matte('#ffe7a8', { emissive: '#ffb84a', emissiveIntensity: 0.5 }), 3.04, 1.1, 1.4, 0, 3.4, -3.5)
  box(g, body, 2.5, 0.3, 0.9, 0, 0.56, 5.6) // cowcatcher
  return g
}

function buildWagon(laden) {
  const T = YARD.train
  const g = new Group()
  const wood = matte(T.wagon)
  const logMat = matte('#a8733f')
  const cut = matte('#e3c493')
  box(g, matte(T.body), 2.5, 0.34, 9, 0, 0.95, 0)
  for (const z of [-3, 3]) {
    for (const x of [-1.1, 1.1]) bar(g, matte('#23252e'), 0.5, 0.2, x, 0.5, z, 'x', 12)
  }
  for (const x of [-1.2, 1.2]) for (const z of [-3.8, -1.3, 1.3, 3.8]) box(g, wood, 0.18, 2, 0.18, x, 2, z)
  if (!laden) {
    box(g, wood, 2.4, 0.1, 8.8, 0, 1.17, 0)
    return g
  }
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - (row === 2 ? 1 : 0); i++) {
      const x = (i - (row === 2 ? 0.5 : 1)) * 0.78
      const y = 1.5 + row * 0.66
      bar(g, logMat, 0.38, 8.6, x, y, 0, 'z', 9)
      for (const z of [-4.31, 4.31]) bar(g, cut, 0.33, 0.03, x, y, z, 'z', 9)
    }
  }
  return g
}

// It passes through with its own logs until the Train Loader is bought. From then on it comes
// with empty wagons and stands at the chute, wagon by wagon, until it is full or its time is up;
// the whole load is paid as it leaves.
function buildTrain(scene, items, trucks) {
  const T = YARD.train
  const train = new Group()
  place(train, buildLocomotive(), 0, 0)
  const LOCO_TAIL = -5.4
  const WAGON = 9.7
  const wagonAt = (i) => LOCO_TAIL - WAGON / 2 - i * WAGON
  const laden = buildWagon(true)
  const empty = buildWagon(false)
  const full = Array.from({ length: T.wagons }, (_, i) => place(train, laden, 0, wagonAt(i)))
  const bare = Array.from({ length: T.wagons }, (_, i) => place(train, empty, 0, wagonAt(i)))
  for (const m of bare) m.visible = false
  train.visible = false
  scene.add(train)

  // Smoke: a short ring of puffs that drift back off the stack as it runs.
  const c = paintSoftDot()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  const puffs = []
  for (let i = 0; i < 12; i++) {
    const s = new Sprite(new SpriteMaterial({ map: tex, color: '#e7e7ea', transparent: true, depthWrite: false, opacity: 0 }))
    s.visible = false
    scene.add(s)
    puffs.push({ sprite: s, age: i / 12 })
  }

  const length = -LOCO_TAIL + WAGON * T.wagons
  const stopZ = GAME.line.trainBelt[1][2] - wagonAt(0) // wagon 0 under the chute
  const room = T.wagons * T.perWagon
  const held = [] // { item, at }: at = its place in the wagons
  let running = false
  let state = 'pass' // pass, or with the Loader: in > dock > out
  let left = 0
  let incoming = 0
  let worth = 0

  function slot(i) {
    const j = i % T.perWagon
    return { x: YARD.rail.x, dz: wagonAt(Math.floor(i / T.perWagon)) + (j % 3 - 1) * 2.9, y: 1.3 + Math.floor(j / 3) * 1.1 }
  }

  // Backstop for a truck caught on the line: the train brakes to a stop short of the nearest
  // truck part on the bed in front of it, and picks up again once it has cleared.
  let yieldV = T.speed
  function yieldTo(z, dt) {
    const { x: railX, bedWidth } = YARD.rail
    const front = z + 6.5
    let gap = Infinity
    for (const rig of trucks.rigs) {
      if (!rig.active) continue
      for (const p of rig.points) {
        if (Math.abs(p.position.x - railX) > bedWidth / 2 + 1.5) continue
        const ahead = p.position.z - 8 - front - 2
        if (ahead > -12 && ahead < gap) gap = ahead
      }
    }
    const target = gap === Infinity ? T.speed : Math.sqrt(2 * T.brake * Math.max(gap, 0))
    yieldV = target < yieldV ? Math.max(target, yieldV - T.brake * dt) : Math.min(target, yieldV + T.brake * 0.8 * dt, T.speed)
    return yieldV
  }

  function depart(pay) {
    state = 'out'
    if (pay && held.length) out.onLeft?.(Math.round(worth * T.pay), held.length)
  }

  const out = {
    owned: false,
    onLeft: null,
    onDocked: null,
    get accepting() {
      return out.owned && state === 'dock' && held.length + incoming < room
    },
    get ready() {
      return out.accepting
    },
    // True while a truck must not start over the crossing level with this z.
    blocks(z) {
      return running && z > train.position.z - length - 4 && z < train.position.z + T.clearAhead
    },
    own() {
      out.owned = true
      for (const m of full) m.visible = false
      for (const m of bare) m.visible = true
    },
    // Throws an item from (x, y, z) into the next free place in the wagons.
    load(item, from) {
      const at = held.length + incoming
      const s = slot(at)
      incoming++
      worth += trucks.worth(item)
      items.fly(item, from, { x: s.x, y: s.y, z: train.position.z + s.dz }, 0.4, () => {
        incoming--
        held.push({ item, at })
      })
    },
    send() {
      running = true
      yieldV = T.speed
      train.visible = true
      train.position.set(YARD.rail.x, 0, -T.span)
      state = out.owned ? 'in' : 'pass'
      worth = 0
      held.length = 0
      for (const p of puffs) p.sprite.visible = true
    },
    // [running, z in tenths, state, s left at the chute, the load's item codes].
    snapshot(code) {
      return [running ? 1 : 0, Math.round(train.position.z * 10), TRAIN_STATES.indexOf(state), Math.round(left), held.map((h) => code(h.item))]
    },
    restore([on, z, stateIndex, stands, load], item) {
      if (!on) return // a train here runs on to the end of the line by itself
      if (!running) out.send()
      if (Math.abs(train.position.z - z / 10) > 12) train.position.z = z / 10
      state = TRAIN_STATES[stateIndex] ?? state
      left = stands
      held.length = 0
      load.forEach((c, at) => {
        const it = item(c)
        if (it) held.push({ item: it, at })
      })
    },
    reset() {
      out.owned = false
      if (state === 'dock' || state === 'in') depart(false)
      held.length = 0
      incoming = 0
      for (const m of full) m.visible = true
      for (const m of bare) m.visible = false
    },
    update(dt) {
      if (!running) return
      const z = train.position.z
      let v = T.speed
      if (state === 'in' || state === 'dock') {
        const wagon = Math.floor((held.length + incoming) / T.perWagon)
        const gap = stopZ + Math.min(wagon, T.wagons - 1) * WAGON - z
        v = Math.min(T.speed, Math.max(gap * 1.6, gap > 0.02 ? 1.5 : 0))
        if (state === 'in' && gap < 0.05) {
          state = 'dock'
          left = T.dock
          out.onDocked?.()
        }
      }
      if (state === 'dock') {
        left -= dt
        if ((left <= 0 || held.length >= room) && !incoming) depart(true)
      }
      v = Math.min(v, yieldTo(z, dt))
      train.position.z += v * dt
      for (const { item, at } of held) {
        const s = slot(at)
        items.add(item, s.x, s.y + items.rest(item) * 0.8, train.position.z + s.dz, 0, 0.8)
      }
      if (v > 0) {
        for (const p of puffs) {
          const before = p.age
          p.age = (p.age + dt * 0.75) % 1
          if (p.age < before) p.sprite.position.set(YARD.rail.x, 5.4, train.position.z + 4.4)
          const k = p.age
          p.sprite.position.y += dt * 2.2
          p.sprite.position.x += dt * 0.8
          p.sprite.scale.setScalar(1.2 + k * 3.6)
          p.sprite.material.opacity = (1 - k) * 0.8
        }
      }
      if (train.position.z - length > T.span) {
        running = false
        train.visible = false
        held.length = 0
        for (const p of puffs) p.sprite.visible = false
      }
    },
  }
  return out
}

// The trucks that take the goods away. One stands in its bay until it is full and drives off out
// of its gate and up the road; its replacement comes down the road in time to be backed in once the
// trip (Delivery Time plus GAME.trucks.drive each way) is up, as whatever the Truck Level now is,
// with a lucky paint job (WINDOWS.depot.lucky) if it rolled one. Everything sold is paid on the
// spot, the Truck Level's bonus when the load fills up: the trip only decides when the next load
// can go on. A bought Truck Level swaps a parked truck there and then.
function createTrucks(scene, items, lighting, stats, remote) {
  const T = GAME.trucks
  const R = T.route
  const level = () => T.levels[stats.truckLevel]
  const trip = (name) => T.levels.find((l) => l.rig === name).trip ?? 1
  const pool = new Map() // rig name -> rigs out of sight
  const rigs = []
  const world = {
    rigs,
    player: null,
    train: null,
    night: false,
    sound(name, x, z) {
      if (remote) return
      const you = world.player?.position
      const near = you ? 1 - Math.hypot(x - you.x, z - you.z) / 70 : 0
      if (near > 0) SOUND[name](near)
    },
  }

  function take(name) {
    const rig = pool.get(name)?.pop()
    if (rig) return rig
    const made = createRig(scene, name, world)
    rigs.push(made)
    return made
  }
  function release(rig) {
    rig.hide()
    if (!pool.has(rig.name)) pool.set(rig.name, [])
    pool.get(rig.name).push(rig)
  }

  // A bay's three runs. `bend` and `clear` are how far along `back` and `out` the bend ends.
  function routes(z) {
    const { x0, laneOut, laneIn, turnOut, turnBack } = R
    const startTurn = laneOut + turnOut
    const mouth = laneIn + turnBack
    return {
      out: trace(x0, z).to(startTurn, z).arc(startTurn, z - turnOut, turnOut, Math.PI / 2, Math.PI).to(laneOut, R.reach).done(),
      in: trace(laneIn, R.reach).to(laneIn, z + 70).done({ near: true }),
      back: trace(x0, z).to(mouth, z).arc(mouth, z + turnBack, turnBack, -Math.PI / 2, -Math.PI).to(laneIn, z + 70).done(),
      bend: x0 - mouth + (turnBack * Math.PI) / 2,
      clear: x0 - startTurn + (turnOut * Math.PI) / 2,
    }
  }

  function truck(x, z, owned) {
    const way = routes(z)
    const bayS = (rig) => R.x0 - (T.tailX - rig.T.tail)
    // Where it stops on the lane, the drive axles far enough past the bend for the trailer, as a
    // distance from that bend.
    const pastBend = (rig) => R.turnBack + R.backStop + rig.T.reach - rig.T.kingpin
    const t = {
      owned,
      x,
      z,
      load: 0,
      booked: 0, // items on the Truck Conveyer on their way to it
      worth: 0, // what the load on board sold for
      lucky: null, // the WINDOWS.depot.lucky entry this trip rolled
      left: 0, // s until it can take a load again
      state: 'bay', // bay > gone
      rig: null, // the truck in the bay
      outgoing: null, // the one on its way off
      coming: null, // the one on its way in
      reversing: false,
      settle: 0,
      get ready() {
        return this.owned && this.state === 'bay'
      },
      get room() {
        return level().items - this.load - this.booked
      },
      tag: null,
      tagTex: null,
      // Stands this rig in the bay: the tags fit its length. The player walks through it.
      dock(rig) {
        t.rig = rig
        const len = rig.T.nose + rig.T.tail
        const mid = T.tailX - len / 2
        t.tag.position.set(mid, rig.T.height + 1.1, z)
        t.luckyTag.position.set(mid, rig.T.height + 2.4, z)
      },
      own() {
        t.owned = true
        t.dock(t.rig)
        t.tag.visible = true
        for (const u of t.rig.points) u.visible = true
      },
      setLucky(lucky, rig) {
        t.lucky = lucky
        rig.rainbow = !!lucky?.rainbow
        rig.paint.color.set(lucky?.color ?? YARD.rigs[rig.name].paint)
        t.luckyTag.visible = !!lucky
        t.luckyTex.userData.paint()
      },
      roll(rig) {
        let r = Math.random() * 100
        t.setLucky(WINDOWS.depot.lucky.find((l) => (r -= l.chance) < 0) ?? null, rig)
      },
      // A truck of the current Truck Level, standing in this bay.
      fresh() {
        const rig = take(level().rig)
        rig.place(way.out, bayS(rig))
        return rig
      },
      reset(on) {
        t.owned = on
        t.load = 0
        t.booked = 0
        t.worth = 0
        t.state = 'bay'
        t.left = 0
        t.settle = 0
        t.reversing = false
        for (const rig of [t.rig, t.outgoing, t.coming]) if (rig) release(rig)
        t.outgoing = t.coming = null
        const rig = t.fresh()
        for (const u of rig.points) u.visible = on
        t.dock(rig)
        t.setLucky(null, rig)
        t.tag.visible = on
        t.tagTex.userData.paint()
      },
      // A Truck Level was bought: a parked truck turns into the new one where it stands.
      refit() {
        if (!t.owned || t.state !== 'bay' || t.rig.name === level().rig) return
        const old = t.rig
        const rig = t.fresh()
        release(old)
        t.dock(rig)
        t.setLucky(t.lucky, rig)
        rig.setLoad(t.load)
        rig.pop()
        items.burst(T.tailX - rig.T.tail / 2, 3, z, 40)
        world.sound('horn', T.tailX, z)
      },
      // Full: off it goes once the last item has landed.
      leave() {
        t.state = 'gone'
        t.settle = T.settle
        t.left = T.settle + (T.drive * 2 + stats.delivery) * trip(level().rig)
      },
      callIn() {
        const rig = take(level().rig)
        t.coming = rig
        t.load = 0
        t.worth = 0
        t.tagTex.userData.paint()
        rig.place(way.in, 0)
        rig.v = R.cruise
        t.roll(rig)
        rig.drive(way.in, 0, z + pastBend(rig) - R.reach, false, () => {
          t.settle = R.backWait
        })
      },
      update(dt) {
        if (t.state === 'bay') return
        t.left = Math.max(1, t.left - dt)
        if (t.rig) {
          t.settle -= dt
          if (t.settle > 0) return
          const rig = t.rig
          t.rig = null
          t.outgoing = rig
          t.tag.visible = t.luckyTag.visible = false
          world.sound('horn', T.tailX, z)
          rig.drive(way.out, rig.s, null, false, () => {
            t.outgoing = null
            release(rig)
          })
          return
        }
        if (!t.coming) {
          if (t.left <= arrival(way, level().rig) * trip(level().rig)) t.callIn()
          return
        }
        // Stopped past the gate: wait for the old truck to clear, then reverse round the bend.
        const rig = t.coming
        if (rig.moving || t.reversing) return
        t.settle -= dt
        if (t.settle > 0) return
        if (t.outgoing && t.outgoing.s < way.clear + t.outgoing.T.tail + t.outgoing.T.nose) return
        t.reversing = true
        t.tag.visible = true
        rig.drive(way.back, way.bend - R.turnBack + pastBend(rig), bayS(rig), true, () => {
          t.reversing = false
          t.coming = null
          t.state = 'bay'
          t.dock(rig)
          t.refit() // the level was bought while it was on the road
          if (t.lucky) out.onLucky?.(t.lucky)
        })
      },
    }
    t.tagTex = paintLoadTag(() => `TRUCK ${t.load}/${level().items}`)
    t.tag = new Sprite(new SpriteMaterial({ map: t.tagTex, transparent: true, depthWrite: false, fog: false }))
    t.tag.scale.set(4.6, 0.86, 1)
    t.tag.visible = owned
    t.luckyTex = paintLuckyTag(() => `x$${t.lucky?.mult ?? 1}`)
    t.luckyTag = new Sprite(new SpriteMaterial({ map: t.luckyTex, transparent: true, depthWrite: false, fog: false }))
    t.luckyTag.scale.set(3, 1.5, 1)
    t.luckyTag.visible = false
    scene.add(t.tag, t.luckyTag)
    const rig = t.fresh()
    t.dock(rig)
    for (const u of rig.points) u.visible = owned
    return t
  }

  // How long a truck of this name takes from the far end of the road into a bay, on a clear run.
  const times = new Map()
  function arrival(way, name) {
    let known = times.get(way)
    if (!known) times.set(way, (known = new Map()))
    if (!known.has(name)) {
      const rig = rigTemplate(name)
      const past = R.turnBack + R.backStop + rig.reach - rig.kingpin
      const lane = travelTime(way.in, 0, way.in.len - 70 + past, false, R.cruise)
      known.set(name, lane + R.backWait + travelTime(way.back, way.bend - R.turnBack + past, R.x0 - T.tailX + rig.tail, true))
    }
    return known.get(name)
  }

  const list = [truck(YARD.ownedTruck.x, YARD.ownedTruck.z, true), ...T.bays.map((b) => truck(b.x, b.z, false))]
  // The trucks parked in the bays still to unlock (the Rebirth 1 slot is a machine, see sawmill.js).
  const parked = new Map()
  for (const L of YARD.locked.filter((l) => l.sale)) {
    parked.set(L.sale, {
      shape: silhouette(scene, buildOwnedTruck(), L.x, L.z, L.yaw, L.scale),
    })
  }
  const out = {
    list,
    rigs,
    cash: 1, // the rebirth multiplier
    onSold: null,
    onLucky: null,
    set train(train) {
      world.train = train
    },
    // What one item sells for, before a lucky truck.
    worth: (item) => GAME.products[item.kind].value * item.mult * out.cash,
    // Pays for one item and throws it on the truck from `from`; with none, it's been set down there.
    sell(item, t, from) {
      let value = out.worth(item) * (t.lucky?.mult ?? 1)
      const { rig, load } = t
      t.load++
      t.worth += value
      t.tagTex.userData.paint()
      if (from) items.fly(item, from, rig.slot(load), 0.45, () => rig.setLoad(load + 1))
      else rig.setLoad(load + 1)
      if (t.load >= level().items) {
        t.leave()
        value += Math.round((t.worth * level().bonus) / 100)
      }
      out.onSold?.(value)
    },
    repaint() {
      for (const t of list) t.tagTex.userData.paint()
    },
    // A Truck Level was bought.
    refit() {
      for (const t of list) t.refit()
    },
    // Back to the one truck the game starts with.
    reset() {
      list.forEach((t, i) => t.reset(i === 0))
    },
    // Each bay as [gone?, load, lucky entry + 1], for a neighbour's copy.
    snapshot: () => list.map((t) => [t.state === 'gone' ? 1 : 0, t.load, WINDOWS.depot.lucky.indexOf(t.lucky) + 1]),
    restore(bays) {
      bays.forEach(([gone, load, lucky], i) => {
        const t = list[i]
        if (!t?.owned) return
        if (t.state === 'bay' && !t.rig) return
        if (gone && t.state === 'bay') t.leave()
        else if (!gone && t.state === 'bay' && t.load !== load) {
          t.load = load
          t.tagTex.userData.paint()
          t.rig?.setLoad(load)
        }
        const shown = WINDOWS.depot.lucky[lucky - 1] ?? null
        if (t.lucky !== shown && t.rig && t.state === 'bay') t.setLucky(shown, t.rig)
      })
    },
    // Each bay as [gone?, load, lucky entry + 1], for a neighbour's copy.
    snapshot: () => list.map((t) => [t.state === 'gone' ? 1 : 0, t.load, WINDOWS.depot.lucky.indexOf(t.lucky) + 1]),
    restore(bays) {
      bays.forEach(([gone, load, lucky], i) => {
        const t = list[i]
        if (!t?.owned) return
        if (t.state === 'bay' && !t.rig) return
        if (gone && t.state === 'bay') t.leave()
        else if (!gone && t.state === 'bay' && t.load !== load) {
          t.load = load
          t.tagTex.userData.paint()
          t.rig?.setLoad(load)
        }
        const shown = WINDOWS.depot.lucky[lucky - 1] ?? null
        if (t.lucky !== shown && t.rig && t.state === 'bay') t.setLucky(shown, t.rig)
      })
    },
    // Parks or clears the locked truck that stands in for the sale `id`, if there is one.
    showParked(id, on) {
      const truck = parked.get(id)
      if (!truck) return
      truck.shape.visible = on
    },
    update(dt, elapsed, player) {
      world.player = player
      world.night = lighting.isNight()
      for (const t of list) t.update(dt)
      for (const r of rigs) if (r.active) r.update(dt / trip(r.name), elapsed)
    },
  }
  return out
}

export function buildVehicles(scene, items, lighting, stats, remote = false) {
  const { opTruck: P } = YARD
  const trucks = createTrucks(scene, items, lighting, stats, remote)
  const opTruck = place(scene, rigShowpiece('op'), P.x, P.z, P.yaw, 0, P.scale)
  const train = buildTrain(scene, items, trucks)
  trucks.train = train
  return { opTruck, train, trucks }
}
