import './tutorial.css'
import { Vector3 } from 'three'
import { GAME, TUTORIAL, YARD } from './config.js'
import { createGuide } from './guide.js'
import { onKey } from './input.js'
import { player } from './player.js'
import * as sfx from './audio/sfx.js'

// Walks a new player through the first load: equip the axe, chop, carry logs to the truck, buy the
// Debarker, carry logs to the pile. `stage` is what the save keeps. The task within a stage is
// read off the world every frame, so a loaded save, a player who runs ahead and a tree someone else
// fells all land on the right one, and it never stops the player doing anything else.
// The hands hold TUTORIAL.carry until it ends (`game.tutorialCarry`).
const { crossings, edge, logs, skip, stages, tasks } = TUTORIAL
const STAGE = { equip: 0, truck: 1, debarker: 2, pile: 3 }
const ARROW = '<svg viewBox="0 0 48 48"><path d="M24 3 44 25H32V45H16V25H4Z"/></svg>'
const lineX = GAME.line.x

export function createTutorial({ scene, game, hud, yard, loaded, onStage }) {
  const { forest } = yard
  const { plot } = game
  const debarkerCost = YARD.saleSigns.find((s) => s.id === 'debarker').cost
  const sellRing = plot.sellRings.find((r) => r.sell === 0)
  const logsRing = plot.logsRings[0]
  const buyRing = plot.buyRings.find((r) => r.spec.buy === 'debarker').spec
  const guide = createGuide(scene)

  hud.root.insertAdjacentHTML(
    'beforeend',
    `<div class="tut-card" hidden>
      <div class="tut-pips">${'<i></i>'.repeat(stages)}</div>
      <b></b><span></span>
      <button class="tut-skip" type="button"></button>
    </div>
    <div class="tut-point" hidden>${ARROW}</div>
    <div class="tut-edge" hidden>${ARROW}<b></b></div>`,
  )
  const card = hud.root.querySelector('.tut-card')
  const pips = card.querySelectorAll('i')
  const title = card.querySelector('b')
  const sub = card.querySelector('span')
  const skipButton = card.querySelector('.tut-skip')
  const point = hud.root.querySelector('.tut-point')
  const compass = hud.root.querySelector('.tut-edge')
  const compassArrow = compass.querySelector('svg')
  const compassText = compass.querySelector('b')

  let stage = 0
  let started = false
  let waited = 0
  let doneLeft = 0
  let sold = 0 // logs on the truck this session
  let piled = 0 // logs on the pile this session
  let settle = 0 // s the felled tree's logs are still in the air
  let sureLeft = 0 // s the second press of Skip still counts
  let tree = null // the tree the arrows are on
  let task = ''
  let pointLeft = 0
  let pointed = null
  const goal = { x: 0, z: 0 }
  const seen = new Vector3()

  const running = () => started && stage < stages

  function setStage(next) {
    if (next === stage) return
    stage = next
    pips.forEach((pip, i) => pip.classList.toggle('on', i < stage))
    onStage()
  }

  function showCard({ title: head, sub: text, touch }) {
    const fingers = document.body.classList.contains('touch-ui')
    const small = fingers ? (touch ?? text) : text
    const line = head.replace('{n}', `${game.logsHeld}/${logs}`)
    const skipText = sureLeft > 0 ? skip.sure : fingers ? skip.label : skip.keyLabel
    if (title.textContent !== line) title.textContent = line
    if (sub.textContent !== small) sub.textContent = small
    if (skipButton.textContent !== skipText) skipButton.textContent = skipText
    skipButton.classList.toggle('sure', sureLeft > 0)
    card.hidden = false
  }

  function close() {
    game.tutorialCarry = 0
    guide.hide()
    card.hidden = true
    point.hidden = true
    compass.hidden = true
    pointAt(null)
  }

  function finish() {
    setStage(stages)
    close()
    doneLeft = TUTORIAL.doneTime
    showCard(TUTORIAL.done)
    card.classList.add('done')
    sfx.reward()
  }

  // Saved like a finish: a skipped tutorial never comes back. Logs over the limit stay in hand
  // until they're put down.
  function pressSkip() {
    if (!running()) return
    if (sureLeft <= 0) {
      sureLeft = skip.sureTime
      return
    }
    sureLeft = 0
    setStage(stages)
    close()
    game.setAxe(true)
  }
  skipButton.addEventListener('click', pressSkip)
  onKey(skip.key, pressSkip)

  function start() {
    started = true
    game.tutorialCarry = TUTORIAL.carry
    game.setAxe(stage > STAGE.equip)
    pips.forEach((pip, i) => pip.classList.toggle('on', i < stage))
  }

  function advance() {
    if (stage === STAGE.equip && game.axeOn) setStage(STAGE.truck)
    if (stage === STAGE.truck && sold && !game.carrying && hud.money >= debarkerCost) setStage(STAGE.debarker)
    if (stage > STAGE.equip && stage < STAGE.pile && plot.owned.has('debarker')) setStage(STAGE.pile)
    if (stage === STAGE.pile && piled >= logs) finish()
  }

  // Gets `need` logs in hand, then `last` takes them on.
  function gather(need, last) {
    if (game.logsHeld >= need) return last
    if (forest.nearestLog(player.position.x, player.position.z)) return 'pick'
    return settle > 0 ? 'timber' : 'chop'
  }

  function currentTask() {
    if (!game.axeOn) return 'equip'
    if (game.carried.count > game.logsHeld) return 'truck' // something off the pallet
    if (stage === STAGE.debarker && hud.money >= debarkerCost) return 'debarker'
    if (stage === STAGE.pile) return gather(logs - piled, 'pile')
    return gather(Math.max(1, logs - sold), 'truck')
  }

  function aimAt(which) {
    const p = player.position
    if (which === 'chop') {
      if (tree?.state !== 'up') tree = forest.freeTree(p.x, p.z)
      if (!tree) return false
      goal.x = tree.x
      goal.z = tree.z
      return true
    }
    const spot = which === 'pick' ? forest.nearestLog(p.x, p.z) : which === 'truck' ? sellRing : which === 'pile' ? logsRing : which === 'debarker' ? buyRing : null
    if (!spot) return false
    goal.x = spot.x
    goal.z = spot.z
    return true
  }

  // The nearest gap in the line of machines, if the way to the goal goes across it.
  function crossing(p) {
    if (p.x < lineX === goal.x < lineX) return null
    const z = p.z + ((goal.z - p.z) * (lineX - p.x)) / (goal.x - p.x)
    return crossings.reduce((best, c) => (Math.abs(c - z) < Math.abs(best - z) ? c : best))
  }

  function aimGuide(spec) {
    const { x, z } = goal
    const scale = spec.beacon === 'tree' ? tree.scale : 1
    const gap = crossing(player.position)
    guide.aim(x, z, TUTORIAL.beaconHeight[spec.beacon] * scale, gap == null ? null : lineX, gap)
  }

  function pointAt(el) {
    if (el === pointed) return
    pointed?.classList.remove('tut-glow')
    el?.classList.add('tut-glow')
    pointed = el
  }

  // The UI arrow, sat on top of a button and pointing down at it.
  function updatePoint(spec, dt) {
    if ((pointLeft -= dt) > 0) return
    pointLeft = TUTORIAL.pointEvery
    const el = spec.point ? document.querySelector(spec.point) : null
    const box = el?.getClientRects().length ? el.getBoundingClientRect() : null
    point.hidden = !box
    pointAt(box ? el : null)
    if (box) point.style.transform = `translate(${box.left + box.width / 2}px, ${box.top}px)`
  }

  // The UI arrow at the screen's edge, while the goal is off screen.
  function updateCompass(camera, spec) {
    const p = player.renderPosition
    seen.set(goal.x, 1, goal.z).project(camera)
    const behind = seen.z > 1
    const onScreen = !behind && Math.abs(seen.x) < edge.x && Math.abs(seen.y) < edge.y
    compass.hidden = !spec.beacon || onScreen
    if (compass.hidden) return
    const x = behind ? -seen.x : seen.x
    const y = behind ? -1 : seen.y // behind the camera, down the screen reads as "turn round"
    const angle = Math.atan2(x, y)
    const w = window.innerWidth / 2
    const h = window.innerHeight / 2
    const px = w + Math.min(w * edge.rx * 2, w - edge.gap) * Math.sin(angle)
    const py = h - Math.min(h * edge.ry * 2, h - edge.gap) * Math.cos(angle)
    compass.style.transform = `translate(${px}px, ${py}px)`
    compassArrow.style.transform = `rotate(${angle}rad)`
    const metres = `${Math.round(Math.hypot(goal.x - p.x, goal.z - p.z))}m`
    if (compassText.textContent !== metres) compassText.textContent = metres
  }

  const out = {
    get stage() {
      return stage
    },
    get task() {
      return task
    },
    // A save: unset means it's from before the tutorial, so that player needs none of it.
    hydrate(doc) {
      stage = doc.tutorial ?? stages
      started = false
      if (stage < stages) return start()
      started = true
      close()
      game.setAxe(true)
    },
    sold() {
      if (running()) sold++
    },
    piled() {
      if (running()) piled++
    },
    update(dt, elapsed, camera) {
      if (doneLeft > 0 && (doneLeft -= dt) <= 0) {
        card.hidden = true
        card.classList.remove('done')
      }
      if (!started) {
        waited += dt
        if (loaded() || waited > TUTORIAL.saveWait) start()
        else return
      }
      if (stage >= stages) return
      advance()
      if (stage >= stages) return
      sureLeft = Math.max(0, sureLeft - dt)
      if (tree?.state === 'falling') settle = 0.6
      else settle -= dt
      task = currentTask()
      const spec = tasks[task]
      showCard(spec)
      if (spec.beacon && aimAt(task)) aimGuide(spec)
      else guide.hide()
      guide.update(elapsed, player.renderPosition)
      updatePoint(spec, dt)
      updateCompass(camera, spec)
    },
  }
  return out
}
