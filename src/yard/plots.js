import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { COARSE_POINTER, LIGHT, PLOTS, YARD } from '../config.js'
import { createHolder, setHolder } from '../physics.js'
import { fontReady, label, yawQuat } from '../propkit.js'
import { createBook } from '../stats.js'
import { landColliders } from '../world.js'
import { buildYard } from './index.js'
import { itemCode } from './items.js'
import { buildRailroad } from './perimeter.js'
import { createPlot } from './plot.js'
import { bakeYard, createAtlas, disposeBake } from './standIn.js'
import { restoreFast, restoreSlow } from './sync.js'

// The five yards round the player's own. Each is the same yard built by buildYard into a group, with
// its own numbers and colliders. Nothing here answers input, and no message can reach one: all a
// neighbour's yard ever does is follow what its owner's client says, so watching is all anyone can do.
//
// The player's own yard stays at the origin, so the game's coordinates mean what they always did,
// and the others stand where they stand relative to it. Which slot is ours is only known once the
// server answers, so until then the others wait as if we had slot 0; moving a yard is just its
// group and the one body its colliders hang from.
//
// Five whole yards are far more than the frame can carry, and they all stand within 70 m, so only
// the ones the viewer is at are ever real (`live`): their group is in the scene and runs every frame.
// The rest are out of the scene, stopped, with a stand-in (standIn.js) in `shell` where they stand,
// and their owners' frames just wait in `fastFrame` and `slowFrame`. Colliders stay either way.
const FAR = { x: 1e6, y: 0, z: 1e6 }

function buildYardPlot(scene, lighting, floor) {
  const group = new Group()
  const shell = new Group() // what stands here whichever way the yard is drawn
  scene.add(shell)
  const view = { turned: false }
  const book = createBook()
  const holder = createHolder()
  setHolder(holder)
  const yard = buildYard(group, lighting, { book, remote: true, view })
  landColliders(true)
  setHolder(null)
  group.add(floor())
  const plot = createPlot(yard, { book })
  const name = new Group()
  name.position.set(8, PLOTS.nameY, 10)
  shell.add(name)
  return { group, shell, view, book, holder, yard, plot, name, shown: '', slot: -1, owner: null, json: null, live: false, baked: null, ownBake: false, bakeIn: 0, range: 0, fastFrame: null, slowFrame: null, placed: { x: 0, z: 0, turned: false }, fresh: yard.forest.snapshot(itemCode) }
}

// How far `v` stands from the fence of a yard placed `at`.
function fenceRange({ x: ax, z: az, turned }, v) {
  const { west, east, north, south } = PLOTS.area
  const x = turned ? ax - v.x : v.x - ax
  const z = turned ? az - v.z : v.z - az
  return Math.hypot(Math.max(west - x, 0, x - east), Math.max(north - z, 0, z - south))
}

// Where slot `other` stands from slot `me`.
function placing(me, other) {
  const a = PLOTS.seats[me]
  const b = PLOTS.seats[other]
  const turned = a.side !== b.side
  return { x: turned ? PLOTS.axis * 2 : 0, z: a.side * (b.row - a.row) * PLOTS.pitch, turned }
}

function setName(e, text) {
  if (e.shown === text) return
  e.shown = text
  for (const old of e.name.children.splice(0)) {
    old.material.map?.dispose()
    old.material.dispose()
  }
  if (text) e.name.add(label(text, PLOTS.nameHeight, { color: '#ffffff', outline: '#1a0a14', font: '700 96px Fredoka, sans-serif', outlineWidth: 14 }))
}

export function createPlots(scene, lighting, concrete) {
  const { concrete: C, rail } = YARD
  const pad = concrete.clone()
  pad.polygonOffset = true
  pad.polygonOffsetFactor = -2
  pad.polygonOffsetUnits = -2
  // A neighbour's concrete lies on the lawn, held up by polygon offset like the tarmac drives.
  const floor = () => {
    const m = new Mesh(new PlaneGeometry(C.east - C.west, C.south - C.north), pad)
    m.rotation.x = -Math.PI / 2
    m.position.set((C.west + C.east) / 2, 0, (C.north + C.south) / 2)
    m.receiveShadow = true
    return m
  }

  const entries = Array.from({ length: PLOTS.seats.length - 1 }, () => buildYardPlot(scene, lighting, floor))

  // The far column has rails of its own; the road is shared.
  const farRail = new Group()
  buildRailroad(farRail)
  const bed = new Mesh(new PlaneGeometry(rail.bedWidth, rail.length), new MeshStandardMaterial({ color: rail.bed, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
  bed.rotation.x = -Math.PI / 2
  bed.position.x = rail.x
  bed.receiveShadow = true
  farRail.add(bed)
  farRail.position.x = PLOTS.axis * 2
  farRail.rotation.y = Math.PI
  scene.add(farRail)

  let me = -1

  function place(mine) {
    me = mine
    let i = 0
    for (let slot = 0; slot < PLOTS.seats.length; slot++) {
      if (slot === mine) continue
      const e = entries[i++]
      const at = placing(mine, slot)
      e.slot = slot
      e.placed = at
      e.view.turned = at.turned
      e.group.position.set(at.x, 0, at.z)
      e.group.rotation.y = at.turned ? Math.PI : 0
      e.shell.position.copy(e.group.position)
      e.shell.rotation.y = e.group.rotation.y
      e.holder.setTranslation({ x: at.x, y: 0, z: at.z }, true)
      e.holder.setRotation(yawQuat(at.turned ? Math.PI : 0), true)
    }
  }
  place(0)

  const bySlot = (slot) => entries.find((e) => e.slot === slot)
  const atlas = createAtlas(COARSE_POINTER ? PLOTS.atlas.phone : PLOTS.atlas.size, COARSE_POINTER ? PLOTS.atlas.cell / 2 : PLOTS.atlas.cell)
  fontReady.then(atlas.redraw)
  const byRange = [...entries]
  let quality = null // the graphics preset
  let emptyYard = null // the stand-in of a yard with nobody in it: all of them share it
  let baking = null // { e, job }: the one stand-in being made

  function showBake(e, baked, own) {
    if (e.baked) {
      e.shell.remove(e.baked)
      if (e.ownBake) disposeBake(e.baked)
    }
    e.baked = baked
    e.ownBake = own
    baked.visible = !e.live
    e.shell.add(baked)
  }

  // Back to a yard with nobody in it.
  function vacate(e) {
    if (baking?.e === e) baking = null
    e.owner = null
    e.json = null
    e.fastFrame = e.slowFrame = null
    e.plot.load({})
    e.plot.setPerks([])
    e.yard.workers.setCount(0)
    e.yard.forest.restore(e.fresh, () => null)
    setName(e, '')
    if (emptyYard) showBake(e, emptyYard.clone(), false)
  }

  function follow(e, p) {
    if (p.plot === e.json) return
    e.json = p.plot
    e.bakeIn = Math.min(e.bakeIn, PLOTS.bakeSoon)
    let state = null
    try {
      state = JSON.parse(p.plot || '{}')
    } catch {
      return
    }
    try {
      e.plot.follow(state)
    } catch (err) {
      console.warn('[plots] could not follow a yard', err)
    }
  }

  function step(e, dt, elapsed, camera) {
    const { items } = e.yard
    items.begin()
    e.yard.update(dt, elapsed, camera, FAR)
    items.end(dt)
  }

  // Sets a stopped yard to what its owner last said.
  function catchUp(e) {
    if (e.slowFrame) restoreSlow(e.yard, e.slowFrame)
    e.slowFrame = null
  }

  function setLive(e, on, dt, elapsed, camera) {
    e.live = on
    if (e.baked) e.baked.visible = !on
    if (!on) {
      e.shell.parent.remove(e.group)
      e.bakeIn = PLOTS.bakeSoon // the yard has moved on since the stand-in was taken
      return
    }
    if (baking?.e === e) baking = null
    catchUp(e)
    if (e.fastFrame) restoreFast(e.yard, e.fastFrame)
    e.fastFrame = null
    step(e, dt, elapsed, camera)
    e.shell.parent.add(e.group)
  }

  function startBake(e, dt, elapsed, camera) {
    catchUp(e)
    step(e, dt, elapsed, camera)
    return bakeYard(e.group, new Set(e.yard.movers()), atlas)
  }

  function bakeEmpty(dt, elapsed, camera) {
    const job = startBake(entries[0], dt, elapsed, camera)
    emptyYard = job.step(Infinity)
    for (const e of entries) if (!e.baked) showBake(e, emptyYard.clone(), false)
  }

  // One stand-in at a time, a little each frame. A yard stays as it was until the new one is done.
  function bakeNext(dt, elapsed, camera) {
    if (!baking) {
      for (const e of entries) {
        if (!e.owner || e.live) continue
        e.bakeIn -= dt
        if (baking || e.bakeIn > 0 || !e.shell.visible) continue
        e.bakeIn = Infinity // until its owner buys something, or the viewer has been in it
        baking = { e, job: startBake(e, dt, elapsed, camera) }
      }
    }
    if (!baking) return
    try {
      const baked = baking.job.step(PLOTS.bakeBudget)
      if (!baked) return
      showBake(baking.e, baked, true)
    } catch (err) {
      console.warn('[plots] could not bake a yard', err) // a yard changed under it: the next take is fine
    }
    baking = null
  }

  const out = {
    get slot() {
      return me
    },
    entries,
    // Where a point of slot `slot`'s own yard lands in this world: writes x, z and yaw on `to`.
    map(slot, x, z, yaw, to) {
      const e = bySlot(slot)
      if (!e) return null
      const { placed: at } = e
      to.x = at.turned ? at.x - x : x
      to.z = (at.turned ? -z : z) + at.z
      to.yaw = at.turned ? yaw + Math.PI : yaw
      return to
    },
    fast(slot, frame) {
      const e = bySlot(slot)
      if (!e?.owner) return
      if (e.live) restoreFast(e.yard, frame)
      else e.fastFrame = frame
    },
    slow(slot, frame) {
      const e = bySlot(slot)
      if (!e?.owner) return
      if (e.live) restoreSlow(e.yard, frame)
      else e.slowFrame = frame
    },
    // The graphics preset: how far off a yard is drawn, and how many may be live.
    configure(preset) {
      quality = preset
    },
    // Called each frame with the room's roster (null offline) and where the viewer stands.
    update(dt, elapsed, camera, viewer, roster, mine) {
      if (!emptyYard) bakeEmpty(dt, elapsed, camera)
      if (mine >= 0 && mine !== me) {
        for (const e of entries) if (e.owner) vacate(e)
        place(mine)
      }
      const owners = new Map()
      roster?.forEach((p, id) => {
        if (id !== roster.mine) owners.set(p.slot, p)
      })
      for (const e of entries) {
        const p = owners.get(e.slot) ?? null
        if (p !== e.owner) {
          if (e.owner) vacate(e)
          e.owner = p
          e.bakeIn = PLOTS.bakeSoon
        }
        if (p) {
          setName(e, p.username || 'Player')
          follow(e, p)
        }
        e.range = fenceRange(e.placed, viewer)
        e.shell.visible = e.range < quality.view
        // Past the sun's shadow box a stand-in would only draw itself a second time for nothing.
        const casts = quality.standInShadows && e.range < LIGHT.shadowRange
        for (const m of e.baked.children) m.castShadow = casts && !m.material.transparent
      }
      // The nearest yards in reach are the real thing, and stay so a little way back out.
      byRange.sort((a, b) => a.range - b.range)
      let room = quality.liveYards
      for (const e of byRange) {
        const want = room > 0 && e.range < (e.live ? PLOTS.liveLeave : PLOTS.liveRange)
        if (want) room--
        if (want !== e.live) setLive(e, want, dt, elapsed, camera)
        if (e.live && e.owner) step(e, dt, elapsed, camera)
      }
      bakeNext(dt, elapsed, camera)
    },
  }
  return out
}
