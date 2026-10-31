import { BufferAttribute, Color, ExtrudeGeometry, GreaterDepth, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, Shape } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { TUTORIAL } from './config.js'

// The tutorial's 3D arrows: a stream of them along the ground from the player to the goal, and a
// big one spinning over the goal, with a faint copy that shows through whatever stands in front.
const { beacon, colors, trail } = TUTORIAL
const FILL = new Color(colors.fill)
const SIDE = new Color(colors.side)
const EDGE = new Color(colors.edge)
const EDGE_GROW = 1.22 // the outline's size, times the arrow's

// An arrow pointing up +Y, its middle at the origin.
function arrowShape() {
  const s = new Shape()
  s.moveTo(0, 1)
  s.lineTo(0.72, 0.1)
  s.lineTo(0.28, 0.1)
  s.lineTo(0.28, -1)
  s.lineTo(-0.28, -1)
  s.lineTo(-0.28, 0.1)
  s.lineTo(-0.72, 0.1)
  s.closePath()
  return s
}

function paint(geo, faces, sides = faces) {
  const normals = geo.attributes.normal
  const colours = new Float32Array(normals.count * 3)
  for (let i = 0; i < normals.count; i++) (Math.abs(normals.getZ(i)) > 0.9 ? faces : sides).toArray(colours, i * 3)
  geo.setAttribute('color', new BufferAttribute(colours, 3))
  return geo
}

// Dark edge plus lit arrow, one mesh, centred on the thickness too.
function arrowGeometry(depth) {
  const solid = (d) => new ExtrudeGeometry(arrowShape(), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)
  const edge = paint(solid(depth * 0.8).scale(EDGE_GROW, EDGE_GROW, 1), EDGE)
  return mergeGeometries([edge, paint(solid(depth), FILL, SIDE)])
}

const unlit = { vertexColors: true, toneMapped: false, fog: false }

export function createGuide(scene) {
  const group = new Group()
  group.visible = false
  scene.add(group)

  const lying = arrowGeometry(0.16).rotateX(-Math.PI / 2) // lies on the ground, pointing at -Z
  const arrows = new InstancedMesh(lying, new MeshBasicMaterial(unlit), trail.max)
  arrows.frustumCulled = false
  arrows.count = 0
  group.add(arrows)

  const standing = arrowGeometry(0.5).rotateZ(Math.PI) // points down
  const big = new Group()
  const solid = new Mesh(standing, new MeshBasicMaterial(unlit))
  const ghost = new Mesh(standing, new MeshBasicMaterial({ color: colors.ghost, transparent: true, opacity: 0.35, depthFunc: GreaterDepth, depthWrite: false, toneMapped: false, fog: false }))
  ghost.renderOrder = 1
  big.add(solid, ghost)
  group.add(big)

  const dummy = new Object3D()
  const to = { x: 0, y: 0, z: 0 }
  const via = { x: 0, z: 0, on: false }
  let height = 0

  const leg = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az)

  // Lays arrows along player > via > goal, `at` m along and moving on with time.
  function layArrows(p, elapsed) {
    const legA = via.on ? leg(p.x, p.z, via.x, via.z) : leg(p.x, p.z, to.x, to.z)
    const legB = via.on ? leg(via.x, via.z, to.x, to.z) : 0
    const total = legA + legB - trail.stop
    let n = 0
    let at = trail.start + ((elapsed * trail.speed) % trail.spacing)
    while (at < total && n < trail.max) {
      const onA = at < legA
      const [ax, az] = onA ? [p.x, p.z] : [via.x, via.z]
      const [bx, bz] = onA && via.on ? [via.x, via.z] : [to.x, to.z]
      const length = leg(ax, az, bx, bz) || 1
      const k = (onA ? at : at - legA) / length
      const size = trail.size * Math.min(1, (at - trail.start) / trail.spacing + 0.5, (total - at) / trail.spacing + 0.3)
      dummy.position.set(ax + (bx - ax) * k, trail.y, az + (bz - az) * k)
      dummy.rotation.y = Math.atan2(ax - bx, az - bz)
      dummy.scale.setScalar(size)
      dummy.updateMatrix()
      arrows.setMatrixAt(n++, dummy.matrix)
      at += trail.spacing
    }
    arrows.count = n
    arrows.instanceMatrix.needsUpdate = true
  }

  return {
    // The goal, the arrow's height over it and any gap to walk through on the way.
    aim(x, z, top, gapX, gapZ) {
      to.x = x
      to.z = z
      height = top
      via.on = gapX != null
      if (via.on) {
        via.x = gapX
        via.z = gapZ
      }
      group.visible = true
    },
    hide() {
      group.visible = false
    },
    update(elapsed, p) {
      if (!group.visible) return
      layArrows(p, elapsed)
      const k = Math.min(1, Math.max(0, (Math.hypot(p.x - to.x, p.z - to.z) - beacon.far) / beacon.far))
      big.scale.setScalar(beacon.size * (1 + (beacon.farScale - 1) * k))
      big.position.set(to.x, height + big.scale.x + Math.sin(elapsed * beacon.bobRate) * beacon.bob, to.z)
      big.rotation.y = elapsed * beacon.spin
    },
  }
}
