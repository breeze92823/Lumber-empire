import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { NET, PLOTS, YARD } from '../config.js'
import { createHolder, setHolder } from '../physics.js'
import { label, yawQuat } from '../propkit.js'
import { createBook } from '../stats.js'
import { landColliders } from '../world.js'
import { buildYard } from './index.js'
import { itemCode } from './items.js'
import { buildRailroad } from './perimeter.js'
import { createPlot } from './plot.js'
import { restoreFast, restoreSlow } from './sync.js'

// The five yards round the player's own. Each is the same yard built by buildYard into a group, with
// its own numbers and colliders. Nothing here answers input, and no message can reach one: all a
// neighbour's yard ever does is follow what its owner's client says, so watching is all anyone can do.
//
// The player's own yard stays at the origin, so the game's coordinates mean what they always did,
// and the others stand where they stand relative to it. Which slot is ours is only known once the
// server answers, so until then the others wait as if we had slot 0; moving a yard is just its
// group and the one body its colliders hang from.
const FAR = { x: 1e6, y: 0, z: 1e6 }

function buildYardPlot(scene, lighting, floor) {
  const group = new Group()
  scene.add(group)
  const view = { turned: false }
  const book = createBook()
  const holder = createHolder()
  setHolder(holder)
  const yard = buildYard(group, lighting, { book, remote: true, view })
  landColliders()
  setHolder(null)
  group.add(floor())
  const plot = createPlot(yard, { book })
  const name = new Group()
  name.position.set(8, PLOTS.nameY, 10)
  group.add(name)
  return { group, view, book, holder, yard, plot, name, shown: '', slot: -1, owner: null, json: null, wait: 0, placed: { x: 0, z: 0, turned: false }, fresh: yard.forest.snapshot(itemCode) }
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
      e.holder.setTranslation({ x: at.x, y: 0, z: at.z }, true)
      e.holder.setRotation(yawQuat(at.turned ? Math.PI : 0), true)
    }
  }
  place(0)

  const bySlot = (slot) => entries.find((e) => e.slot === slot)

  // Back to a yard with nobody in it.
  function vacate(e) {
    e.owner = null
    e.json = null
    e.plot.load({})
    e.plot.setPerks([])
    e.yard.workers.setCount(0)
    e.yard.forest.restore(e.fresh, () => null)
    setName(e, '')
  }

  function follow(e, p) {
    if (p.plot === e.json) return
    e.json = p.plot
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
      if (e?.owner) restoreFast(e.yard, frame)
    },
    slow(slot, frame) {
      const e = bySlot(slot)
      if (e?.owner) restoreSlow(e.yard, frame)
    },
    // Called each frame with the room's roster (null offline) and where the viewer stands.
    update(dt, elapsed, camera, viewer, roster, mine) {
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
        }
        if (!p) continue
        setName(e, p.username || 'Player')
        follow(e, p)
        e.wait += dt
        const near = Math.hypot(e.group.position.x - viewer.x, e.group.position.z - viewer.z) < PLOTS.nearRange
        if (e.wait < (near ? 0 : PLOTS.farStep)) continue
        step(e, Math.min(e.wait, NET.slowEvery), elapsed, camera)
        e.wait = 0
      }
    },
  }
  return out
}
