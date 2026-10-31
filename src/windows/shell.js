import './windows.css'

// The shared popup frame: black border, gradient banner with a white inset line, orange X,
// over a blur of the world (the veil, under the HUD). Only one window is open at a time;
// a click on the world or Esc closes it (main.js routes Esc here before the portal menu).
// Ported from the old game's uiWindow.js (git HEAD), restyled to the Lumber references.
let current = null // the open window, if any

const veil = document.createElement('div')
veil.className = 'uiw-veil'
veil.hidden = true
veil.addEventListener('pointerdown', () => closeTopWindow())
document.body.append(veil)

// Closes the open window. Returns true if there was one (so Esc can stop there).
export function closeTopWindow() {
  if (!current) return false
  current.close()
  return true
}

// Restarts a one-shot CSS animation ('uiw-pop', 'uiw-shake').
export function replay(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

// Boxity's toolbar (bloxity.onReservedAreas) sits over the top-left corner, over the whole
// top edge on narrow phones. A frame that would reach under it is fitted into the screen
// below it instead (--uiw-top on its overlay, windows.css).
const TOOLBAR_GAP = 8 // px kept clear under the toolbar
let toolbar = null
export function setWindowReserved(areas) {
  toolbar = areas.find((a) => a.id === 'toolbar') ?? null
  if (current) fitClear(current)
}
window.addEventListener('resize', () => current && fitClear(current))

function fitClear({ overlay, frame }) {
  overlay.style.removeProperty('--uiw-top')
  if (!toolbar?.width || !toolbar.height) return
  const bottom = toolbar.top + toolbar.height
  // Offsets, not the bounding box: the open animation scales the frame.
  const under =
    frame.offsetLeft < toolbar.left + toolbar.width &&
    toolbar.left < frame.offsetLeft + frame.offsetWidth &&
    frame.offsetTop < bottom + TOOLBAR_GAP
  if (under) overlay.style.setProperty('--uiw-top', `${bottom + TOOLBAR_GAP}px`)
}

// options: { title, icon (svg markup, may be empty), extra (markup in the banner), className
// (on the overlay, sets --w / --h there for another size), onOpen, onClose }.
// Returns { body, open, close, isOpen }; the caller fills `body`.
export function createWindow({ title, icon = '', extra = '', className = '', onOpen, onClose }) {
  const overlay = document.createElement('div')
  overlay.className = `uiw ${className}`
  overlay.hidden = true
  overlay.innerHTML = `
    <div class="uiw-frame" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="uiw-head">
        <div class="uiw-banner">
          ${icon && `<span class="uiw-icon">${icon}</span>`}
          <h2 class="uiw-title">${title}</h2>
          ${extra}
        </div>
        <button class="uiw-close uiw-tap" type="button" aria-label="Close">X</button>
      </div>
      <div class="uiw-body"></div>
    </div>`
  document.body.append(overlay)
  const frame = overlay.querySelector('.uiw-frame')

  let shown = false
  const win = {
    overlay,
    frame,
    body: overlay.querySelector('.uiw-body'),
    isOpen: () => shown,
    open() {
      if (shown) return
      current?.close()
      current = win
      shown = true
      document.body.classList.add('uiw-open') // windows.css: the left HUD column folds away
      veil.hidden = false
      overlay.hidden = false
      onOpen?.()
      fitClear(win)
      replay(frame, 'uiw-pop')
      document.activeElement?.blur() // a focused HUD button would fire again on Space
      document.exitPointerLock?.() // the cursor has to be free to press the buttons
    },
    close() {
      if (!shown) return
      shown = false
      current = null
      document.body.classList.remove('uiw-open')
      veil.hidden = true
      overlay.hidden = true
      onClose?.()
    },
  }
  overlay.querySelector('.uiw-close').addEventListener('click', win.close)
  return win
}
