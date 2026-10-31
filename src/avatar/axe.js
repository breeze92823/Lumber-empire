import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { PLAYER_DIMS, RIG_HEIGHT, YARD } from '../config.js'

const handleGeo = new BoxGeometry(0.09, 1.15, 0.09)
const headGeo = new BoxGeometry(0.08, 0.38, 0.52)
let mats = null

// A lumberjack's axe, for the player and the others alike.
export function buildAxe() {
  mats ??= { handle: new MeshStandardMaterial({ color: YARD.workers.axe.handle }), head: new MeshStandardMaterial({ color: YARD.workers.axe.head }) }
  const axe = new Group()
  const handle = new Mesh(handleGeo, mats.handle)
  handle.position.y = 0.15
  const head = new Mesh(headGeo, mats.head)
  head.position.set(0, 0.56, 0.2)
  handle.castShadow = head.castShadow = true
  axe.add(handle, head)
  axe.rotation.x = Math.PI / 2.4
  return axe
}

// Put in the right hand of the bind pose, then parented to the forearm so it follows any rig.
// attach() keeps that world pose whatever the bone's own frame is.
export function giveAxe(character, axe) {
  const bone = character.nodes?.ArmR2 ?? character.nodes?.ArmR1
  if (!bone) return
  const k = RIG_HEIGHT / PLAYER_DIMS.height
  axe.removeFromParent()
  character.add(axe)
  axe.position.set(-2, 2.5, 0.2)
  axe.scale.setScalar(k)
  character.updateMatrixWorld(true)
  bone.attach(axe)
}
