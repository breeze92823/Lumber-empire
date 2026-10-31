import { BufferAttribute, Color, ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Quaternion, Sprite, SpriteMaterial, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { clamp, GAME, PLOTS, YARD } from '../config.js'
import { label, solidPole } from '../propkit.js'
import { mulberry32 } from '../textures.js'
import { bake } from '../bake.js'
import { bar, box, matte } from './kit.js'

// The forest east of the concrete: low-poly pines of four flared tiers on a dark
// trunk with stubby roots. One pine geometry is instanced for every tree; the
// foliage carries a dark-crown-to-light-skirt gradient in vertex colours and each
// instance is tinted, which is all that separates a golden pine from a green one.
const TIERS = [
  { r: 3.5, h: 2.5, y: 3.1 },
  { r: 2.95, h: 2.3, y: 4.7 },
  { r: 2.3, h: 2.1, y: 6.1 },
  { r: 1.55, h: 2.2, y: 7.45 },
]
const TRUNK = { top: 0.42, bottom: 0.72, height: 4, roots: 5 }

// Paints a geometry from `crown` at its highest point to `skirt` at its lowest.
function shade(geo, skirt, crown) {
  const pos = geo.attributes.position
  geo.computeBoundingBox()
  const { min, max } = geo.boundingBox
  const colors = new Float32Array(pos.count * 3)
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    c.copy(skirt).lerp(crown, (pos.getY(i) - min.y) / (max.y - min.y || 1))
    colors.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  return geo
}

const flat = (geo) => (geo.index ? geo.toNonIndexed() : geo)

function foliageGeometry() {
  const parts = []
  const skirt = new Color('#ffffff')
  const crown = new Color('#8aa090')
  const lip = new Color('#7d9486')
  for (const t of TIERS) {
    const cone = flat(new ConeGeometry(t.r, t.h, 8, 1, true))
    cone.rotateY(Math.PI / 8)
    cone.translate(0, t.y + t.h / 2, 0)
    parts.push(shade(cone, skirt, crown))
    // The darker skirt under each tier.
    const band = flat(new CylinderGeometry(t.r, t.r * 0.86, 0.32, 8, 1, false))
    band.rotateY(Math.PI / 8)
    band.translate(0, t.y - 0.16, 0)
    parts.push(shade(band, lip, lip))
  }
  return mergeGeometries(parts.map(strip))
}

// mergeGeometries wants the same attributes on every piece.
function strip(g) {
  for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(n)) g.deleteAttribute(n)
  return g
}

function trunkGeometry() {
  const parts = [flat(new CylinderGeometry(TRUNK.top, TRUNK.bottom, TRUNK.height, 7)).translate(0, TRUNK.height / 2, 0)]
  for (let i = 0; i < TRUNK.roots; i++) {
    const a = (i / TRUNK.roots) * Math.PI * 2
    const root = flat(new CylinderGeometry(0.22, 0.4, 1.3, 5))
    root.rotateZ(Math.PI / 2.3)
    root.translate(0.72, 0.18, 0)
    root.rotateY(a)
    parts.push(root)
  }
  return mergeGeometries(parts.map(strip))
}

// Where every tree goes. Rows follow the reference: staggered, spaced so a
// worker can reach any trunk, with a clear strip along the concrete.
function layout() {
  const { forest: F } = YARD
  const rand = mulberry32(F.seed)
  const { rows, outer } = F
  // Trees placed by hand, plus the clearing round the More Forest ring.
  const planted = [...F.fixed, ...F.big]
  const clearings = [...planted, ...YARD.rings.filter((r) => r.x > YARD.concrete.east).map((r) => [r.x, r.z])]
  const free = (x, z) => clearings.every(([cx, cz]) => Math.hypot(x - cx, z - cz) > F.clear)

  const trees = []
  let row = 0
  for (let x = rows.west; x <= rows.east; x += rows.gapX, row++) {
    for (let z = rows.north + (row % 2) * (rows.gapZ / 2); z <= rows.south; z += rows.gapZ) {
      const tx = x + (rand() - 0.5) * rows.jitter
      const tz = z + (rand() - 0.5) * rows.jitter
      if (free(tx, tz)) trees.push({ x: tx, z: tz, solid: true })
    }
  }
  // Past the plot's band they would stand in the next yard. Every tree still takes its turn of
  // `rand`, so the crop comes out the same.
  for (const area of outer) {
    for (let i = 0; i < area.count; i++) {
      const t = { x: area.west + rand() * (area.east - area.west), z: area.north + rand() * (area.south - area.north) }
      if (t.z >= PLOTS.band.north && t.z <= PLOTS.band.south) trees.push(t)
    }
  }
  for (const [x, z] of F.fixed) trees.push({ x, z, solid: true })
  for (const t of trees) t.scale ??= 0.9 + rand() * 0.28
  for (const [x, z] of F.big) trees.push({ x, z, solid: true, scale: 1, big: true })
  for (const [x, z] of F.golden) trees.push({ x, z, golden: true, scale: 1 })
  for (const t of trees) t.yaw = rand() * Math.PI * 2
  return trees
}

function buildStump(x, z, rand) {
  const { forest: F } = YARD
  const g = new Group()
  const bark = matte(F.stump)
  bar(g, bark, 0.72, 0.8, 0, 0.4, 0, 'y', 8)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand()
    box(g, bark, 0.8, 0.3, 0.42, Math.cos(a) * 0.75, 0.14, Math.sin(a) * 0.75, -a)
  }
  bar(g, matte(F.stumpTop), 0.62, 0.05, 0, 0.82, 0, 'y', 10)
  const out = bake(g, true, true)
  out.position.set(x, 0, z)
  return out
}

// The trees inside the fence are the crop: each has its own life of up > falling > gone >
// growing > up, drawn by moving its instance. Logs lie where a tree came down until someone
// walks over them. `onDown(tree)` fires once a tree has landed and dropped its logs. In a neighbour's
// yard (`remote`) the owner says what stands and what lies, through snapshot() and restore(), and
// the trees here only play it out.
export function buildForest(scene, items, { stats, rollTree }, remote = false) {
  const { forest: F } = YARD
  const A = GAME.logArea
  const trees = layout()
  const crop = trees.filter((t) => t.solid)
  const dummy = new Object3D()
  const tilt = new Quaternion()
  const turn = new Quaternion()
  const axis = new Vector3()
  const UP = new Vector3(0, 1, 0)
  const rand = mulberry32(F.seed + 2)

  const foliage = new InstancedMesh(foliageGeometry(), new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }), trees.length)
  const trunks = new InstancedMesh(trunkGeometry(), new MeshStandardMaterial({ color: F.trunk, flatShading: true, roughness: 0.9 }), trees.length)
  const green = new Color(F.foliage[1])
  const gold = new Color(F.goldFoliage[1])
  const typeColor = Object.fromEntries(GAME.trees.map((t) => [t.id, new Color(t.id === 'golden' ? F.goldFoliage[1] : F.foliage[1])]))
  const haunted = new Color(GAME.haunt.foliage)
  const rainbow = new Color()
  const logTint = { golden: GAME.trees.find((t) => t.id === 'golden').color }
  let spooky = false

  // Instance matrices: `lean` radians over toward (fallX, fallZ), `grow` 0..1 of full height.
  function pose(t) {
    turn.setFromAxisAngle(UP, t.yaw)
    tilt.setFromAxisAngle(axis.set(t.fallZ, 0, -t.fallX), t.lean)
    dummy.position.set(t.x, 0, t.z)
    dummy.quaternion.multiplyQuaternions(tilt, turn)
    dummy.scale.setScalar(Math.max(t.scale * t.grow, 1e-4))
    dummy.updateMatrix()
    foliage.setMatrixAt(t.i, dummy.matrix)
    trunks.setMatrixAt(t.i, dummy.matrix)
  }
  function paint(t) {
    const c = t.state === undefined ? (t.golden ? gold : green) : spooky && !t.locked ? haunted : t.type.id === 'rainbow' ? rainbow : typeColor[t.type.id]
    foliage.setColorAt(t.i, c)
  }

  // Only the rare trees carry a tag; a few labels are shared round them.
  const tags = new Map(GAME.trees.filter((t) => t.tag).map((t) => [t.id, []]))
  function tagTree(t) {
    if (remote || !t.type.tag) return
    const tag = tags.get(t.type.id).pop() ?? label(t.type.tag, 0.7, { color: t.type.color, outline: t.type.outline, outlineWidth: 12 })
    tag.position.set(t.x, 10.4 * t.scale, t.z)
    tag.visible = true
    scene.add(tag)
    t.tag = tag
  }
  function untag(t) {
    if (!t.tag) return
    t.tag.visible = false
    tags.get(t.type.id).push(t.tag)
    t.tag = null
  }

  function setType(t, type) {
    t.type = type
    t.scale = t.baseScale * type.scale
    t.hp = t.maxHp = type.hp
  }

  trees.forEach((t, i) => {
    t.i = i
    t.lean = 0
    t.fallX = 1
    t.fallZ = 0
    t.grow = 1
    if (t.solid) {
      t.baseScale = t.scale
      t.locked = t.z >= GAME.lockedFrom
      t.state = 'up'
      t.shake = 0
      t.claim = null
      setType(t, t.big ? GAME.trees.find((k) => k.id === 'big') : rollTree(rand))
      t.pole = solidPole(0.75 * t.scale, 6, t.x, t.z)
      tagTree(t)
    }
    pose(t)
    paint(t)
  })
  foliage.castShadow = trunks.castShadow = true
  foliage.receiveShadow = trunks.receiveShadow = true
  scene.add(foliage, trunks)

  const stumpRand = mulberry32(F.seed + 1)
  for (const [x, z] of F.stumps) {
    scene.add(buildStump(x, z, stumpRand))
    solidPole(0.75, 1, x, z)
  }
  // A felled tree's stump: the same model, one instance per tree of the crop, shown while it is down.
  const hidden = new Matrix4().makeScale(0, 0, 0)
  const stumps = buildStump(0, 0, stumpRand).children.map((part) => {
    const m = new InstancedMesh(part.geometry, part.material, crop.length)
    m.castShadow = true
    m.receiveShadow = true
    for (let i = 0; i < crop.length; i++) m.setMatrixAt(i, hidden)
    scene.add(m)
    return m
  })
  function showStump(t, on) {
    const at = crop.indexOf(t)
    dummy.position.set(t.x, 0, t.z)
    dummy.quaternion.identity()
    dummy.scale.setScalar(t.baseScale)
    dummy.updateMatrix()
    for (const m of stumps) {
      m.setMatrixAt(at, on ? dummy.matrix : hidden)
      m.instanceMatrix.needsUpdate = true
    }
  }

  // The health bar over the tree last hit.
  const barBack = new Sprite(new SpriteMaterial({ color: '#20242e', depthTest: false, fog: false }))
  const barFill = new Sprite(new SpriteMaterial({ color: '#6fe04a', depthTest: false, fog: false }))
  barBack.visible = barFill.visible = false
  barBack.renderOrder = 3
  barFill.renderOrder = 4
  scene.add(barBack, barFill)
  let barTree = null
  let barLeft = 0

  const STATES = ['up', 'falling', 'gone', 'growing']

  // Down it goes, away from (fallX, fallZ)'s far side.
  function fell(t, fallX, fallZ) {
    t.fallX = fallX
    t.fallZ = fallZ
    t.state = 'falling'
    t.timer = 0
    t.pole.setEnabled(false)
    t.claim = null
    barLeft = 0
    untag(t)
    showStump(t, true)
    out.onFell?.(t)
  }
  function regrow(t, type) {
    setType(t, type)
    t.state = 'growing'
    t.pole.setEnabled(true)
    paint(t)
  }

  const ground = [] // { item, x, z, yaw, claim }
  const out = {
    crop,
    ground,
    onHit: null,
    onFell: null,
    onDown: null,
    // The nearest tree standing within `reach` of a trunk's edge, open or not.
    near(x, z, reach) {
      let best = null
      let bestD = reach
      for (const t of crop) {
        if (t.state !== 'up') continue
        const d = Math.hypot(t.x - x, t.z - z) - 0.75 * t.scale
        if (d < bestD) {
          best = t
          bestD = d
        }
      }
      return best
    },
    // The nearest tree a worker may start on.
    freeTree(x, z) {
      let best = null
      let bestD = Infinity
      for (const t of crop) {
        if (t.state !== 'up' || t.locked || t.claim) continue
        const d = Math.hypot(t.x - x, t.z - z)
        if (d < bestD) {
          best = t
          bestD = d
        }
      }
      return best
    },
    nearestLog(x, z, range = Infinity) {
      let best = null
      let bestD = range
      for (const g of ground) {
        if (g.claim) continue
        const d = Math.hypot(g.x - x, g.z - z)
        if (d < bestD) {
          best = g
          bestD = d
        }
      }
      return best
    },
    // Takes a log off the ground; the caller now holds its item.
    takeLog(log) {
      ground.splice(ground.indexOf(log), 1)
      return log.item
    },
    // True if this blow felled it.
    hit(t, damage, fromX, fromZ) {
      if (t.state !== 'up') return false
      t.hp -= damage
      t.shake = 1
      items.burst(t.x, 1.4, t.z)
      out.onHit?.(t)
      barTree = t
      barLeft = 2
      if (t.hp > 0) return false
      const d = Math.hypot(t.x - fromX, t.z - fromZ) || 1
      fell(t, (t.x - fromX) / d, (t.z - fromZ) / d)
      return true
    },
    // A worker's blow as a neighbour sees it: the tree shakes and the chips fly, the owner keeps score.
    shake(t) {
      t.shake = 1
      items.burst(t.x, 1.4, t.z)
    },
    // Each tree of the crop as a number, its logs on the ground as [x, z, item code, yaw] in tenths.
    snapshot(code) {
      const logs = []
      for (const g of ground) logs.push(Math.round(g.x * 10), Math.round(g.z * 10), code(g.item), Math.round(g.yaw * 10))
      return [crop.map((t) => STATES.indexOf(t.state) + GAME.trees.indexOf(t.type) * 4), logs, spooky ? 1 : 0]
    },
    // What fell since the last look: [tree index, fallX, fallZ in hundredths, ...].
    felled(seen, list) {
      for (const t of crop) {
        const down = t.state === 'falling'
        if (down && !seen.has(t)) list.push(crop.indexOf(t), Math.round(t.fallX * 100), Math.round(t.fallZ * 100))
        if (down) seen.add(t)
        else seen.delete(t)
      }
      return list
    },
    fellNow(i, fallX, fallZ) {
      const t = crop[i]
      if (t?.state === 'up') fell(t, fallX / 100, fallZ / 100)
    },
    restore([codes, logs, haunted], item) {
      if (!!haunted !== spooky) out.setHaunted(!!haunted)
      crop.forEach((t, i) => {
        const code = codes[i]
        if (code === undefined) return
        const state = STATES[code % 4]
        const type = GAME.trees[Math.floor(code / 4)]
        if (!type) return
        if (t.state === 'up' && (state === 'falling' || state === 'gone')) fell(t, t.fallX, t.fallZ)
        else if (t.state === 'gone' && (state === 'growing' || state === 'up')) regrow(t, type)
        else if (t.state === 'up' && state === 'up' && t.type !== type) {
          setType(t, type)
          pose(t)
          paint(t)
          foliage.instanceMatrix.needsUpdate = trunks.instanceMatrix.needsUpdate = true
          foliage.instanceColor.needsUpdate = true
        }
      })
      ground.length = 0
      for (let i = 0; i + 3 < logs.length; i += 4) {
        const log = item(logs[i + 2])
        if (log) ground.push({ item: log, x: logs[i] / 10, z: logs[i + 1] / 10, yaw: logs[i + 3] / 10, claim: null })
      }
    },
    openAll() {
      for (const t of crop) {
        t.locked = false
        paint(t)
      }
      foliage.instanceColor.needsUpdate = true
    },
    // Rebirth: logs gone, the far trees closed again.
    reset() {
      ground.length = 0
      for (const t of crop) {
        t.locked = t.z >= GAME.lockedFrom
        t.claim = null
        paint(t)
      }
      foliage.instanceColor.needsUpdate = true
    },
    setHaunted(on) {
      spooky = on
      for (const t of crop) paint(t)
      foliage.instanceColor.needsUpdate = true
    },
    update(dt, elapsed, player) {
      let moved = false
      let tinted = false
      rainbow.setHSL((elapsed * GAME.rainbowSpeed) % 1, 0.85, 0.6)
      for (const t of crop) {
        if (t.state === 'up') {
          if (t.type.id === 'rainbow' && !spooky) tinted = true
          if (t.shake > 0) {
            t.shake = Math.max(0, t.shake - dt * 5)
            t.lean = Math.sin(t.shake * 18) * 0.035 * t.shake
            pose(t)
            moved = true
          }
          continue
        }
        if (t.state === 'falling') {
          t.timer += dt / GAME.fallTime
          const k = Math.min(t.timer, 1)
          t.lean = k * k * (Math.PI / 2 - 0.08)
          pose(t)
          moved = true
          if (k >= 1) {
            for (let i = 0; i < (remote ? 0 : t.type.logs); i++) {
              const along = 2 + (i / Math.max(t.type.logs - 1, 1)) * 5 * t.scale
              const item = { kind: 'log', mult: spooky ? GAME.haunt.multiplier : (t.type.mult ?? 1), tint: spooky ? GAME.haunt.log : (logTint[t.type.id] ?? null), rainbow: t.type.id === 'rainbow' && !spooky }
              const x = clamp(t.x + t.fallX * along + (rand() - 0.5) * 1.6, A.west, A.east)
              const z = clamp(t.z + t.fallZ * along + (rand() - 0.5) * 1.6, A.north, A.south)
              const landing = { item, x, z, yaw: rand() * Math.PI * 2, claim: null }
              items.fly(item, { x: t.x + t.fallX * along, y: 1.4, z: t.z + t.fallZ * along }, { x, y: 0.42, z }, 0.4, () => ground.push(landing))
            }
            while (ground.length > GAME.maxGroundLogs) ground.shift()
            t.state = 'gone'
            t.grow = 0
            t.lean = 0
            t.timer = stats.regrow
            pose(t)
            out.onDown?.(t)
          }
        } else if (t.state === 'gone') {
          t.timer -= dt
          if (!remote && t.timer <= 0 && Math.hypot(player.x - t.x, player.z - t.z) > 2.4) {
            regrow(t, rollTree(rand))
            tinted = true
          }
        } else if (t.state === 'growing') {
          t.grow = Math.min(1, t.grow + dt / GAME.growTime)
          pose(t)
          moved = true
          if (t.grow >= 1) {
            t.state = 'up'
            showStump(t, false)
            tagTree(t)
          }
        }
      }
      if (moved) foliage.instanceMatrix.needsUpdate = trunks.instanceMatrix.needsUpdate = true
      if (tinted) foliage.instanceColor.needsUpdate = true

      barLeft -= dt
      const showBar = barLeft > 0 && barTree?.state === 'up'
      barBack.visible = barFill.visible = showBar
      if (showBar) {
        const y = 4.8
        barBack.position.set(barTree.x, y, barTree.z)
        barFill.position.set(barTree.x, y, barTree.z)
        barBack.scale.set(2.6, 0.34, 1)
        barFill.scale.set(2.5 * (barTree.hp / barTree.maxHp), 0.24, 1)
      }

      for (const g of ground) items.add(g.item, g.x, 0.42, g.z, g.yaw)
    },
  }
  return out
}
