import { COARSE_POINTER, GAME, WINDOWS, YARD } from '../config.js'
import { createEmitter } from '../particles.js'
import { book as ownBook } from '../stats.js'
import { buildAir } from './airstrip.js'
import { buildBoards } from './boards.js'
import { buildFeeds } from './feeds.js'
import { buildForest } from './forest.js'
import { createItems } from './items.js'
import { buildFloors } from './floors.js'
import { buildLifters } from './lifters.js'
import { createLine, createSky } from './line.js'
import { buildPerimeter } from './perimeter.js'
import { buildSawmills } from './sawmill.js'
import { buildStations } from './stations.js'
import { buildVehicles } from './vehicles.js'
import { itemFrom } from './items.js'
import { remoteTextures } from './paint.js'
import { buildPuppets, buildWorkers } from './workers.js'
import { buildClosedHatch } from './tunnel.js'

// The player's lumber yard, everything inside the fence plus the railroad and
// forest around it. buildYard wires the pieces up; each file owns one kind of thing.

// Floor shade baked into the concrete under the big props (paintConcrete).
export function yardContacts() {
  const { ownedTruck: O, opTruck: P, locked, stall: S, workerBoard: W, playerBoard: B, saleSigns, hacker: H, machines: M, leaderboard: L } = YARD
  return [
    { x: O.x, z: O.z, rx: 5.2, rz: 2.8, a: 0.34 },
    ...GAME.trucks.bays.map((b) => ({ x: b.x, z: b.z, rx: 5.2, rz: 2.8, a: 0.2 })),
    { x: P.x, z: P.z, rx: 5, rz: 5, a: 0.3 },
    ...locked.filter((l) => l.shade).map((l) => ({ x: l.x, z: l.z, rx: 3.2, rz: 5, a: 0.3 })),
    { x: S.x, z: S.z, rx: 3.6, rz: 2.4 },
    { x: W.x, z: W.z, rx: 6.4, rz: 1.4 },
    { x: B.x, z: B.z, rx: 7.2, rz: 1.4 },
    ...saleSigns.filter((s) => !s.later && !s.floor).map((s) => ({ x: s.x, z: s.z, rx: 1.3, rz: 3 })),
    { x: M.kiln.x, z: M.kiln.z, rx: 4, rz: 6, a: 0.24 },
    { x: H.x, z: H.z, rx: 3.4, rz: 2.2, a: 0.22 },
    { x: L.x, z: L.z, rx: 8, rz: 4.4, a: 0.2 },
  ]
}

// Sawdust blowing out of a machine's mouths, chips kicked from its blade: both only run while
// it has an item inside, so they are returned for the yard to switch.
function millDust(scene, mill) {
  const { fx } = YARD
  return [
    createEmitter(scene, {
      boxes: [
        { x: mill.x, y: 1.5, z: mill.z + 2.3, sx: 0.5, sy: 0.3, sz: 0.1 },
        { x: mill.x, y: 1.5, z: mill.z - 2.3, sx: 0.5, sy: 0.3, sz: 0.1 },
      ],
      count: fx.sawdust.count,
      life: fx.sawdust.life,
      velocity: [0, 1.5, 0],
      spread: [1.2, 1.1, 1.3],
      gravity: 2.4,
      size: fx.sawdust.size,
      grow: 1.8,
      color: fx.sawdust.color,
      opacity: 0.75,
      solid: true,
      seed: 3,
    }),
    createEmitter(scene, {
      boxes: [{ x: mill.x, y: 1.7, z: mill.z + 2.6, sx: 0.4, sy: 0.1, sz: 0.2 }],
      count: fx.chips.count,
      life: fx.chips.life,
      velocity: [0, 3, 1.4],
      spread: [1.6, 1.2, 0.8],
      gravity: 9,
      size: fx.chips.size,
      color: fx.chips.color,
      solid: true,
      seed: 4,
    }),
  ]
}

// The Debarker Turbo's own particles. The first set only runs while it works: heavy sawdust out
// of both mouths, chips and orange sparks off the gantry, and smoke up the flue. The second just
// shimmers over the body for as long as it stands.
function turboFx(scene, mill) {
  const { fx } = YARD
  const T = fx.turbo
  const gantry = { x: mill.x, y: 2.4, z: mill.z - 1.2, sx: 1.3, sy: 0.8, sz: 0.7 }
  const working = [
    createEmitter(scene, {
      boxes: [-2.3, 2.3].map((dz) => ({ x: mill.x, y: 1.5, z: mill.z + dz, sx: 0.8, sy: 0.3, sz: 0.1 })),
      count: T.dust,
      life: 1.3,
      velocity: [0, 2.2, 0],
      spread: [1.9, 1.5, 1.9],
      gravity: 3.2,
      size: fx.sawdust.size * 1.2,
      grow: 2,
      color: fx.sawdust.color,
      opacity: 0.8,
      solid: true,
      seed: 21,
    }),
    createEmitter(scene, {
      boxes: [gantry],
      count: T.chips,
      life: 1,
      velocity: [0, 4.5, -1.2],
      spread: [2.4, 1.8, 1.6],
      gravity: 11,
      size: fx.chips.size * 1.2,
      color: fx.chips.color,
      solid: true,
      seed: 22,
    }),
    createEmitter(scene, {
      boxes: [gantry],
      count: T.sparks,
      life: 0.9,
      velocity: [0, 1.8, -0.6],
      spread: [1.5, 1.3, 1.5],
      gravity: 6,
      size: 0.2,
      color: '#ffb02e',
      intensity: 2.6,
      twinkle: 12,
      sprite: 'sparkle',
      seed: 23,
    }),
    createEmitter(scene, {
      boxes: [{ x: mill.x - 1.35, y: 6.7, z: mill.z + 0.85, sx: 0.12, sy: 0.1, sz: 0.12 }],
      count: T.smoke,
      life: 3.2,
      velocity: [-0.35, 2.2, 0.15],
      spread: [0.3, 0.3, 0.3],
      size: fx.smoke.size,
      grow: 2.6,
      color: fx.smoke.color,
      opacity: 0.5,
      solid: true,
      seed: 25,
    }),
  ]
  const shimmer = [
    createEmitter(scene, {
      boxes: [{ x: mill.x, y: 4.2, z: mill.z + 1.25, sx: 1.7, sy: 0.9, sz: 1 }],
      count: T.glow,
      life: 1.8,
      velocity: [0, 1, 0],
      spread: [0.5, 0.4, 0.5],
      size: 0.18,
      color: '#25e3ff',
      intensity: 2,
      twinkle: 8,
      sprite: 'sparkle',
      seed: 24,
    }),
  ]
  return { working, shimmer }
}

function buildEffects(scene) {
  const { fx, forest, rings, opTruck: P, hacker: H } = YARD
  // Motes rising off the floor rings that stay, in the ring's colour.
  const lasting = rings.filter((r) => !r.buy && !r.sell && !r.logsIn && !r.own)
  createEmitter(scene, {
    boxes: lasting.map((r) => ({ x: r.x, y: 0.2, z: r.z, sx: r.r * 0.75, sy: 0.1, sz: r.r * 0.75, color: r.color })),
    count: fx.ring.count * lasting.length,
    life: fx.ring.life,
    velocity: [0, 0.9, 0],
    spread: [0.1, 0.25, 0.1],
    size: fx.ring.size,
    intensity: 1.6,
    twinkle: 7,
    sprite: 'sparkle',
    seed: 5,
  })
  // The OP truck's sales pitch: cyan and violet sparks round it.
  const pitch = createEmitter(scene, {
    boxes: [
      { x: P.x, y: 2.4, z: P.z, sx: 2.8, sy: 1.9, sz: 3.6, color: P.neon },
      { x: P.x, y: 2.4, z: P.z, sx: 2.8, sy: 1.9, sz: 3.6, color: '#b56cff' },
    ],
    count: fx.op.count,
    life: fx.op.life,
    velocity: [0, 0.7, 0],
    spread: [0.3, 0.3, 0.3],
    size: fx.op.size,
    intensity: 1.8,
    twinkle: 6,
    sprite: 'sparkle',
    seed: 6,
  })
  createEmitter(scene, {
    boxes: [{ x: H.x, y: 0.4, z: H.z + 0.6, sx: H.ringRadius * 0.7, sy: 0.2, sz: H.ringRadius * 0.7 }],
    count: fx.hacker.count,
    life: fx.hacker.life,
    velocity: [0, 1, 0],
    spread: [0.15, 0.3, 0.15],
    size: fx.hacker.size,
    color: fx.hacker.color,
    intensity: 1.5,
    seed: 7,
  })
  // Needles coming down in the forest, out to the airport's fence.
  const r = { ...forest.rows, east: forest.parcels.at(-1).east, south: forest.land.south }
  createEmitter(scene, {
    boxes: fx.leaves.colors.map((color) => ({ x: (r.west + r.east) / 2, y: 8.5, z: (r.north + r.south) / 2, sx: (r.east - r.west) / 2 + 2, sy: 1.5, sz: (r.south - r.north) / 2 + 2, color })),
    count: fx.leaves.count,
    life: fx.leaves.life,
    velocity: [-0.55, -0.95, 0.2],
    spread: [0.45, 0.15, 0.45],
    size: fx.leaves.size,
    opacity: 0.9,
    solid: true,
    seed: 8,
  })
  // Sunlit dust hanging over the yard.
  createEmitter(scene, {
    boxes: [{ x: 0, y: 3, z: 6, sx: 21, sy: 2.6, sz: 34 }],
    count: fx.motes.count,
    life: fx.motes.life,
    velocity: [-0.25, 0.14, 0.2],
    spread: [0.2, 0.1, 0.2],
    size: fx.motes.size,
    color: fx.motes.color,
    intensity: 0.85,
    opacity: 0.8,
    seed: 9,
  })
  return pitch
}

// A neighbour's yard (`remote`) is the same yard built from the same code, inside its own group and
// with its own numbers (`book`), minus what only its owner needs: no Leaderboard, no ambient
// particles, and a crew of puppets. `view.turned` says the group stands turned half way round.
export function buildYard(scene, lighting, { book = ownBook, remote = false, view = null } = {}) {
  remoteTextures(remote)
  const fence = buildPerimeter(scene, remote)
  const items = createItems(scene)
  const forest = buildForest(scene, items, book, remote)
  const boards = buildBoards(scene, remote)
  const vehicles = buildVehicles(scene, items, lighting, book.stats, remote)
  const { trucks } = vehicles
  const { train } = vehicles
  const sky = createSky(items, trucks, train)
  const lines = [0, 1, 2].map((floor) => createLine(items, sky, floor))
  const [line] = lines
  const allMills = lines.map((l) => buildSawmills(scene, l.stages, items, l.base, view))
  const [mills] = allMills
  const stations = buildStations(scene, remote)
  const floors = buildFloors(scene)
  const lifters = buildLifters(scene, lines, items)
  const feeds = buildFeeds(scene, line, items, trucks, sky)
  const air = remote ? null : buildAir(scene, { items, lighting, stats: book.stats, trucks, lines })
  if (remote) buildClosedHatch(scene)
  const workers = remote ? buildPuppets(scene, { items, forest }, itemFrom) : buildWorkers(scene, { forest, lines, trucks, train, items, air }, book.stats)
  let opPitch = null
  if (!remote) {
    workers.setCount(WINDOWS.hire.workers)
    opPitch = buildEffects(scene)
  }
  remoteTextures(false)
  const [debarker, sawmill, kiln] = line.stages
  // Phones skip a neighbour's machine dust: it is far off and each emitter is a draw call.
  const dusty = !remote || !COARSE_POINTER
  const turbo = dusty ? turboFx(scene, YARD.machines.debarker) : { working: [], shimmer: [] }
  const noise = !dusty ? [] : [
    [() => debarker.busy && !debarker.turbo, millDust(scene, YARD.machines.debarker)],
    [() => debarker.busy && debarker.turbo, turbo.working],
    [() => debarker.turbo, turbo.shimmer],
    [() => sawmill.busy, millDust(scene, YARD.machines.sawmill)],
    [() => kiln.busy, [createEmitter(scene, { boxes: [{ x: GAME.line.x, y: 7.2, z: kiln.z - 0.6, sx: 0.3, sy: 0.1, sz: 0.3 }], count: YARD.fx.smoke.count, life: YARD.fx.smoke.life, velocity: [-0.3, 2, 0.2], spread: [0.3, 0.3, 0.3], size: YARD.fx.smoke.size, grow: 2.4, color: YARD.fx.smoke.color, opacity: 0.5, solid: true, seed: 12 })]],
  ]
  if (!remote) for (const l of YARD.lamps) lighting.addLamp(l.x, l.y, l.z, { emissiveIntensity: 0 })

  return {
    items,
    fence,
    forest,
    lines,
    sky,
    trucks,
    train,
    boards,
    mills: allMills,
    stations,
    floors,
    lifters,
    feeds,
    workers,
    air,
    sendTrain: train.send,
    // Bought: the one on show goes, it arrives on the road as the bays' truck.
    soldOpTruck(sold = true) {
      vehicles.opTruck.visible = !sold
      if (opPitch) opPitch.visible = !sold
    },
    pickWorkerToggle(raycaster, from) {
      for (const m of allMills) {
        const sign = m.pickToggle(raycaster, from)
        if (sign) return sign
      }
      return null
    },
    hoverWorkerToggle(on) {
      for (const m of allMills) m.hoverToggle(on)
    },
    pressWorkerToggle: mills.pressToggle,
    pickUpgradeButton: boards.pickUpgradeButton,
    hoverUpgradeButton: boards.hoverUpgradeButton,
    pressUpgradeButton: boards.pressUpgradeButton,
    // What a stand-in (standIn.js) leaves out: from afar a yard is just the yard and its machines.
    movers: () => [train.model, ...items.meshes, ...workers.crew.map((w) => w.g), ...trucks.rigs.flatMap((r) => r.points)],
    // Call between items.begin() and items.end(): it lists what they draw.
    update(dt, elapsed, camera, player) {
      boards.update(dt)
      for (const m of allMills) m.update(dt, elapsed, camera)
      stations.update(dt, elapsed)
      forest.update(dt, elapsed, player)
      for (const l of lines) l.update(dt)
      sky.update(dt)
      feeds.update(dt)
      lifters.update(dt)
      workers.update(dt, elapsed)
      trucks.update(dt, elapsed, player)
      train.update(dt)
      air?.update(dt, elapsed, player)
      for (const [on, emitters] of noise) {
        const visible = on()
        for (const e of emitters) e.visible = visible
      }
    },
  }
}
