import { Group, IcosahedronGeometry, Mesh, MeshLambertMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import { YARD } from './config.js'
import { RAPIER, addFixed } from './physics.js'
import { mulberry32, toTexture } from './textures.js'
import { paintConcrete, paintTurf } from './yard/paint.js'

// The ground: a wide flat lawn with the yard's concrete floor, the rail bed and
// the road let into it. The surfaces are laid edge to edge and never overlap, so
// nothing z-fights however far away it is. Physically it is one big floor.
const FAR = 800 // m the lawn runs out from the yard
const FLOOR_THICKNESS = 2
const FLOOR_MARGIN = 25 // m of physics floor past the concrete, to cover the forest

function strip(root, mat, x0, x1, z0, z1, tile = 0) {
  const geo = new PlaneGeometry(x1 - x0, z1 - z0)
  if (tile) {
    // World-space UVs, so every strip of lawn lines up with its neighbours.
    const uv = geo.attributes.uv
    const pos = geo.attributes.position
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + (x0 + x1) / 2) / tile, (pos.getY(i) - (z0 + z1) / 2) / tile)
  }
  const m = new Mesh(geo, mat)
  m.rotation.x = -Math.PI / 2
  m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2)
  m.receiveShadow = true
  root.add(m)
}

function makeClouds() {
  const rand = mulberry32(2024)
  const geo = new IcosahedronGeometry(1, 3)
  const mat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#dcebff', emissiveIntensity: 0.62, fog: false })
  const group = new Group()
  for (let i = 0; i < 22; i++) {
    // Mostly ahead (-Z), a few all around.
    const ang = i < 15 ? -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.25 : rand() * Math.PI * 2
    const dist = 240 + rand() * 170
    const cloud = new Group()
    const puffs = 5 + Math.floor(rand() * 4)
    const len = 22 + rand() * 26
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (9 + rand() * 6)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.82, r)
      puff.position.set(t * len, r * 0.25 + rand() * 3, (rand() - 0.5) * 8)
      cloud.add(puff)
    }
    const flat = new Mesh(geo, mat) // flat underside
    flat.scale.set(len * 0.62, 4, 9)
    cloud.add(flat)
    cloud.position.set(Math.cos(ang) * dist, 45 + rand() * 70, Math.sin(ang) * dist)
    cloud.lookAt(0, cloud.position.y, 0)
    group.add(cloud)
  }
  return group
}

// The lawn, road, rail bed and concrete. `contacts` = soft floor shade under the props.
export function buildGround(root, contacts) {
  const { concrete: C, grass, rail, road } = YARD
  const turf = new MeshStandardMaterial({ map: toTexture(paintTurf(), { srgb: true }), roughness: 1 })
  const tarmac = new MeshStandardMaterial({ color: road.color, roughness: 0.9 })
  const gravel = new MeshStandardMaterial({ color: rail.bed, roughness: 1 })
  const concrete = new MeshStandardMaterial({ map: toTexture(paintConcrete(contacts), { srgb: true, anisotropy: 16 }), roughness: 0.95 })
  concrete.map.flipY = false // canvas top = north, so the shade lands under its props

  const bedW = rail.x - rail.bedWidth / 2
  const bedE = rail.x + rail.bedWidth / 2
  strip(root, turf, -FAR, road.west, -FAR, FAR, grass.tile)
  strip(root, tarmac, road.west, road.east, -FAR, FAR)
  strip(root, turf, road.east, bedW, -FAR, FAR, grass.tile)
  strip(root, gravel, bedW, bedE, -FAR, FAR)
  strip(root, turf, bedE, C.west, -FAR, FAR, grass.tile)
  strip(root, turf, C.west, C.east, -FAR, C.north, grass.tile)
  strip(root, concrete, C.west, C.east, C.north, C.south)
  strip(root, turf, C.west, C.east, C.south, FAR, grass.tile)
  strip(root, turf, C.east, FAR, -FAR, FAR, grass.tile)
  return concrete
}

// One floor under the yard; the fence's walls keep the player on it (perimeter.js). Only as
// big as it has to be: on a cuboid hundreds of metres wide the character sinks through
// the contact a little more the further it gets from the middle.
export function landColliders() {
  const { concrete: C } = YARD
  const reach = Math.max(-C.west, C.east, -C.north, C.south) + FLOOR_MARGIN
  addFixed(RAPIER.ColliderDesc.cuboid(reach, FLOOR_THICKNESS / 2, reach), { x: 0, y: -FLOOR_THICKNESS / 2, z: 0 }, null, { friction: 0.9 })
}

export function createWorld(scene) {
  scene.add(makeClouds())
  return { update() {} }
}
