import { INTERACT } from './config.js'
import './interact.css'

// Hold-E interactions (ported from Tnt-skipping): a proximity prompt "Press E to <label>" with a
// key cap ringed by a progress ring that fills while E (or a finger/click on the prompt) is held
// for INTERACT.holdMs, then the zone's action fires once.
//
//   registerZone({ id, isNear: () => bool, label: () => string | null, onConfirm })
//
// The first registered zone that is near wins (even when its label is null). A null label hides the prompt.

const zones = []
let active = null
let held = false
let heldSince = 0
let fired = false
let enabled = true
let showing = false

export function registerZone(zone) {
  const i = zones.findIndex((z) => z.id === zone.id)
  if (i >= 0) zones[i] = zone
  else zones.push(zone)
  return () => {
    const k = zones.indexOf(zone)
    if (k >= 0) zones.splice(k, 1)
  }
}

// Off while a window is open.
export function setInteractEnabled(on) {
  enabled = on
}

export const isInteractShowing = () => showing

let el = null
let textEl = null
let keyEl = null
let ring = null
function build() {
  el = document.createElement('div')
  el.className = 'interact'
  el.innerHTML = `<div class="interact-key"><svg viewBox="0 0 44 44"><circle class="interact-track" cx="22" cy="22" r="19"/><circle class="interact-ring" cx="22" cy="22" r="19"/></svg><span>E</span></div><div class="interact-text"></div>`
  textEl = el.querySelector('.interact-text')
  keyEl = el.querySelector('.interact-key span')
  ring = el.querySelector('.interact-ring')
  document.body.appendChild(el)
  const down = (e) => {
    e.preventDefault()
    e.stopPropagation()
    press(true)
  }
  const up = () => press(false)
  el.addEventListener('pointerdown', down)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('pointerleave', up)
}

export function press(on) {
  if (on && !held) {
    held = true
    heldSince = performance.now()
    fired = false
  } else if (!on) held = false
}

export function installInteract() {
  build()
  window.addEventListener('keydown', (e) => {
    if (e.code === INTERACT.key && !e.repeat && showing) press(true)
  })
  window.addEventListener('keyup', (e) => {
    if (e.code === INTERACT.key) press(false)
  })
}

const CIRC = 2 * Math.PI * 19
export function updateInteract() {
  let zone = null
  if (enabled) for (const z of zones) if (z.isNear()) { zone = z; break }
  const label = zone ? (typeof zone.label === 'function' ? zone.label() : zone.label) : null
  if (zone !== active) {
    active = zone
    held = false
  }
  showing = !!label
  el.classList.toggle('show', showing)
  if (!showing) {
    ring.style.strokeDashoffset = CIRC
    return
  }
  // A finger holds the prompt itself: no key to name.
  const finger = document.body.classList.contains('touch-ui')
  textEl.textContent = `${finger ? 'Hold' : 'Press E'} to ${label}`
  keyEl.textContent = finger ? '' : 'E'
  const progress = held ? Math.min(1, (performance.now() - heldSince) / INTERACT.holdMs) : 0
  ring.style.strokeDasharray = CIRC
  ring.style.strokeDashoffset = CIRC * (1 - progress)
  el.classList.toggle('held', held)
  if (progress >= 1 && !fired) {
    fired = true
    held = false
    zone.onConfirm()
  }
}
