import { Clock, Group, NeutralToneMapping, PCFSoftShadowMap, PerspectiveCamera, Raycaster, Scene, SRGBColorSpace, Vector2, WebGLRenderer } from 'three'
import { CAMERA, graphicsPreset, NET, RENDER, WINDOWS } from './config.js'
import * as bloxity from './bloxity.js'
import { install as installInput, isLocked, onKey, releaseInput, setMouseChop } from './input.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn } from './player.js'
import { setCameraSensitivity, syncYawToPlayer, update as updateCamera } from './camera.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { buildGround, createWorld, landColliders } from './world.js'
import { buildYard, yardContacts } from './yard/index.js'
import { createPlots } from './yard/plots.js'
import { captureFast, captureSlow } from './yard/sync.js'
import { setLeaders } from './yard/leaders.js'
import { rigPortraits } from './yard/rigPortrait.js'
import { createGame } from './game.js'
import { createHud } from './hud.js'
import { career, upgradeCost } from './stats.js'
import { initNet, net, onNetMessage, roster, saveNow, sendEmote, sendPose, sendYardFast, sendYardSlow, syncAvatar, syncPlot } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { createBubble } from './bubble.js'
import { installAudio, setAdBreak, setVolume } from './audio/core.js'
import * as sfx from './audio/sfx.js'
import { installInteract, setInteractEnabled, updateInteract } from './interact.js'
import { anyWindowOpen, closeTopWindow, createWindows, setWindowReserved } from './windows/index.js'
import { setParticleDensity, updateParticles } from './particles.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildAxe, giveAxe } from './avatar/axe.js'
import { buildDefaultCharacter } from './avatar/character.js'
import { applyProportions } from './avatar/loader.js'
import { buildLook } from './avatar/look.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { playEmote } from './avatar/emotes.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> ground + sky + lighting,
// player body -> avatar (async, swaps in when ready) -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null

// Settings come from the portal's settings menu (or their defaults offline).
function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'master_volume') setVolume(value / 100)
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    setParticleDensity(next.particles)
    postfx?.setSize(window.innerWidth, window.innerHeight)
  }
}
bloxity.onSetting(applySetting)
bloxity.init()

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = NeutralToneMapping // keeps the flat toy colours; ACES would grey them
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(() => closeTopWindow() || bloxity.showMenu(), renderer.domElement) // Esc closes a window, else opens the portal menu

const scene = new Scene()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
postfx = createPostFx(renderer, scene, camera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- Physics + ground + sky --------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()

lighting = createLighting(scene, renderer, preset)
const world = createWorld(scene) // the clouds
const concrete = buildGround(scene, yardContacts())
landColliders()
const yard = buildYard(scene, lighting)
const hud = createHud({ onTrain: yard.sendTrain, onHome: respawn, onMenu: bloxity.showMenu })
hud.showFps(bloxity.settings.show_fps)
bloxity.onSetting((key, value) => key === 'show_fps' && hud.showFps(value))
const windows = createWindows(
  hud,
  yard.workers.setCount,
  (id) => {
    const result = game.upgrade(id)
    sfx[result]()
    return result
  },
  (rebirths, skipped) => game.rebirth(rebirths, skipped),
)
windows.depot.setPortraits(rigPortraits(renderer, scene.environment))
const game = createGame({ yard, hud })
game.onFloor = windows.hire.raiseMax
bloxity.onReservedAreas(setWindowReserved)

// --- The world's other five yards and the room ------------------------------
bloxity.loadingStep('Building the neighbours')
const plots = createPlots(scene, lighting, concrete)
const remotes = createRemotePlayers(scene, plots)
game.onDraw = remotes.drawHands
onNetMessage('yardFast', ([slot, frame]) => plots.fast(slot, frame))
onNetMessage('yardSlow', ([slot, frame]) => plots.slow(slot, frame))
onNetMessage('leaderboard', (msg) => setLeaders(msg, bloxity.displayName()))
const save = {
  snapshot: () => ({ money: hud.money, earned: career.earned, playtime: Math.floor(career.playtime), crates: hud.crates, ...game.snapshot(), ...windows.snapshot() }),
  hydrate(doc) {
    if (Number.isFinite(doc.money)) hud.setMoney(doc.money)
    if (Number.isFinite(doc.earned)) career.earned = doc.earned
    if (Number.isFinite(doc.playtime)) career.playtime = doc.playtime
    hud.addCrates((doc.crates ?? 0) - hud.crates, WINDOWS.gifts.crateName)
    game.hydrate(doc)
    windows.hydrate(doc)
  },
  plot: () => game.plotState(),
}
initNet(save)

// Board buttons and machine signs: a click (Registered in the capture phase so it buys instead of
// grabbing the cursor) or a tap. With the cursor locked the ray goes through the screen centre.
// Anywhere else a mouse button held on the world swings the axe. A finger only presses on the way
// up, and only if it stayed put: otherwise it was dragging the camera.
installAudio()
installInteract()
{
  const canvas = renderer.domElement
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  let hot = null // what the mouse is on, for the hover tick
  let tap = null // the finger's press in progress
  const onWorld = (e) => e.target === canvas || e.target.classList?.contains('touch-zone')
  const buttonAt = (e) => {
    if (!onWorld(e)) return null
    if (isLocked()) ndc.set(0, 0)
    else ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    return yard.pickUpgradeButton(raycaster.ray, player.position)
  }
  // A machine's floating sign (call after buttonAt, which aims the ray).
  const signAt = (e) => (onWorld(e) ? yard.pickWorkerToggle(raycaster, player.position) : null)
  const press = (button, sign) => {
    if (sign) {
      sfx.toggle(yard.pressWorkerToggle(sign))
      return
    }
    const result = game.press(button)
    yard.pressUpgradeButton(button, result)
    sfx[result]()
  }
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return
      const button = buttonAt(e)
      const sign = button ? null : signAt(e)
      if (e.pointerType !== 'mouse') {
        tap = button || sign ? { button, sign, id: e.pointerId, x: e.clientX, y: e.clientY } : null
        return
      }
      if (!button && !sign) {
        if (e.target === canvas) setMouseChop(true)
        return
      }
      e.stopImmediatePropagation()
      press(button, sign)
    },
    true,
  )
  window.addEventListener(
    'pointerup',
    (e) => {
      if (!tap || e.pointerId !== tap.id) return
      if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 14) press(tap.button, tap.sign)
      tap = null
    },
    true,
  )
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return // no hover on touch: a drag is the camera
    const button = buttonAt(e)
    yard.hoverUpgradeButton(button)
    const sign = button ? null : signAt(e)
    yard.hoverWorkerToggle(sign)
    canvas.style.cursor = button || sign ? 'pointer' : ''
    const next = button || sign
    if (next && next !== hot) sfx.hover()
    hot = next
  })
}
createPlayerBody()
syncYawToPlayer()

// --- Player avatar ----------------------------------------------------------
// The Bloxity base rig (player.glb; procedural fallback if it fails), dressed
// with the signed-in player's equipped cosmetics and body proportions. It
// rebuilds on customizer edits and sign-in/out.
const playerGroup = new Group()
scene.add(playerGroup)
let avatar = null
let animator = null
let generation = 0
let avatarReady = false

const axe = buildAxe()
const bubble = createBubble(playerGroup, 3.2)
bloxity.onChat((uid, text, seconds, local) => {
  if (local) bubble.say(text, seconds)
  else remotes.say(uid, text, seconds)
})

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  avatar = next
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
  giveAxe(avatar, axe)
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const signedIn = !!bloxity.authState.user
    const look = { equipped: signedIn ? bloxity.getEquippedAvatar() : null, proportions: signedIn ? bloxity.getProportions() : null, skin: bloxity.getSkinTextureUrl() }
    const group = await buildLook(look, () => mine !== generation)
    if (group) setAvatar(group)
  } finally {
    if (mine === generation) avatarReady = true
  }
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
bloxity.onAvatarChanged(() => {
  loadAvatar()
  syncAvatar()
})
bloxity.onProportionsChanged(() => {
  applyProportions(avatar, bloxity.getProportions())
  syncAvatar()
})
bloxity.onRespawnRequest(respawn)
bloxity.onEmote((id) => {
  playEmote(() => animator, id)
  sendEmote(id)
})
bloxity.onPointerLock((locked) => locked || releaseInput())

// An ad break freezes the world and silences it. The room stays joined.
let adBreak = false
bloxity.onAdBreak((on) => {
  adBreak = on
  setAdBreak(on)
  releaseInput()
})

// --- Modes + keys --------------------------------------------------------------
onModeChanged((mode) => {
  playerGroup.visible = mode !== 'player' // first person: you are the camera
})
onKey('KeyV', toggleMode)
onKey('KeyN', () => lighting.toggleDayNight())
onKey('KeyR', respawn)
const touchUi = installTouch({ mode: toggleMode, day: () => lighting.toggleDayNight(), respawn })
game.onNearTree = touchUi.showChop

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let shownLoading = true
let readySince = 0
const felled = new Set() // trees already reported down
let fastLeft = 0
let slowLeft = 0
let plotLeft = 0
let friendLeft = 0

// Bloxity friends in this room, for the Friend Boost.
function countFriends() {
  const friends = bloxity.refreshFriends(NET.friendsEvery)
  const players = roster()
  let n = 0
  players?.forEach((p, id) => {
    if (id !== players.mine && friends.has(p.uid)) n++
  })
  return n
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  if (adBreak) return
  const elapsed = clock.elapsedTime

  stepPhysics(dt) // runs the player controller + world at the fixed rate, interpolates bodies
  interpolatePlayer()

  const p = player.renderPosition
  playerGroup.position.set(p.x, p.y, p.z)
  playerGroup.rotation.y = player.facing
  animator?.update(dt, {
    grounded: player.grounded,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: 0,
    carry: game.carrying,
    swing: game.swing,
  })
  axe.visible = !game.carrying || game.swing > 0

  updateCamera(camera, dt)
  world.update(dt, elapsed)
  game.update(dt, elapsed, camera)
  setInteractEnabled(!anyWindowOpen())
  updateInteract()
  hud.update(dt)
  // The floating "!" over the Trucks kiosk and the Workers stall: only while the wallet covers something there.
  const trucksCost = Math.min(upgradeCost('truckLevel') ?? Infinity, upgradeCost('delivery') ?? Infinity)
  yard.stations.setAlert(0, hud.money >= trucksCost)
  yard.stations.setAlert(1, windows.hire.canHire())
  windows.update(dt)
  bubble.update(dt)
  plots.update(dt, elapsed, camera, p, roster(), net.slot)
  remotes.update(dt, p)
  // This player's side of the room: what the others draw of them.
  const { kind, count } = game.carried
  sendPose({ x: p.x, y: p.y, z: p.z, yaw: player.facing, speed: Math.hypot(player.velocity.x, player.velocity.z), swing: game.swing, kind, count })
  if ((fastLeft -= dt) <= 0) {
    fastLeft = NET.fastEvery
    if (net.connected) sendYardFast(captureFast(yard, felled))
  }
  if ((slowLeft -= dt) <= 0) {
    slowLeft = NET.slowEvery
    if (net.connected) sendYardSlow(captureSlow(yard))
  }
  if ((plotLeft -= dt) <= 0) {
    plotLeft = NET.plotEvery
    syncPlot()
  }
  if ((friendLeft -= dt) <= 0) {
    friendLeft = NET.friendCountEvery
    hud.setFriends(countFriends())
  }
  updateParticles(elapsed, renderer.domElement.height)
  lighting.update(dt, playerGroup.position)
  postfx.render()

  // Loading ends once the scene has drawn and the avatar has had its chance (max ~5 s).
  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
    }
  }
}
renderer.setAnimationLoop(frame)

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(-24, 0, 6, Math.PI / 2)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  window.__game = { player, scene, renderer, camera, postfx, yard, hud, windows, lighting, bodies: bodyCount, toggleMode, teleport, game, plots, remotes, net, saveNow, frame, save }
}
