import { Color, DirectionalLight, PerspectiveCamera, Scene, Vector2 } from 'three'
import { AIR, GAME, WINDOWS } from '../config.js'
import { buildPlane } from './aircraft.js'
import { rigShowpiece } from './rigModels.js'

// The Truck Depot's and the Hangar's pictures: each truck of the Truck Level and each plane of the
// Aircraft Level drawn once into a canvas of its own. They render to the corner of the game's canvas
// and copy that out, so call them before the first frame, while the loading screen still covers it.
export const rigPortraits = (renderer, environment) => portraits(renderer, environment, GAME.trucks.levels, ({ rig }) => ({ model: rigShowpiece(rig), far: WINDOWS.depot.portrait.distance, y: 1.9 }))
export const planePortraits = (renderer, environment) =>
  portraits(renderer, environment, GAME.aircraft, ({ plane }) => {
    const { root, spec } = buildPlane(plane)
    return { model: root, far: AIR.planes[plane].len * WINDOWS.hangar.portraitDistance, y: spec.gear + spec.r }
  })

function portraits(renderer, environment, list, build) {
  const P = WINDOWS.depot.portrait
  const scene = new Scene()
  scene.background = new Color(P.background)
  scene.environment = environment
  const sun = new DirectionalLight('#ffffff', P.sun)
  sun.position.set(8, 12, 10)
  scene.add(sun)
  const camera = new PerspectiveCamera(P.fov, 1, 0.1, 100)
  const size = renderer.getSize(new Vector2())
  const ratio = renderer.getPixelRatio()
  const side = Math.min(P.size / ratio, size.x, size.y)
  renderer.setViewport(0, 0, side, side)
  const shots = list.map((entry) => {
    const { model, far, y } = build(entry)
    scene.add(model)
    camera.position.set(far * 0.72, far * 0.34, far * 0.82)
    camera.lookAt(0, y, 0)
    renderer.render(scene, camera)
    scene.remove(model)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = P.size
    const px = side * ratio
    // A tab opened in the background has no size yet: its pictures stay blank rather than stop the boot.
    if (px > 0) canvas.getContext('2d').drawImage(renderer.domElement, 0, renderer.domElement.height - px, px, px, 0, 0, P.size, P.size)
    return canvas
  })
  renderer.setViewport(0, 0, size.x, size.y)
  return shots
}
