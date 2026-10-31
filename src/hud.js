import './hud.css'
import { COARSE_POINTER, HUD, SHOP, YARD, UNLIMITED_MONEY, DEV_MONEY } from './config.js'
import { ICONS } from './hudIcons.js'
import { career } from './stats.js'

// The on-screen HUD. Everything is sized in reference-screenshot pixels times --u
// (set on resize), so the layout holds from phones to desktop. Live: the train timer,
// the wallet with its gains, the hotbar's crates (fed by windows/), what the player carries,
// the first-steps hint and short notices. The Axe slot reports to `onAxe`. Auto Chop, x2 Money and Rush Hour report to `onPerk`
// (shop.js); Settings opens Boxity's menu.
// Boxity draws its own toolbar top-left, so nothing here goes in that corner.
const REF = { w: 1920, h: 985, portraitW: 900 }
const MIN_SCALE = COARSE_POINTER ? 0.46 : 0.36 // on touch, keeps every tile at least 44 px tall
const RIGHT_WIDTH = 232 // .hud-right's width in design px
const RIGHT_MARGIN = 16 // px left over beside it
export const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
// 2500000 -> "$2.5M", 18965 -> "$19K", 1200 -> "$1.2K", 961 -> "$961". 999950 rounds up to "$1M", not "$1000K".
const MONEY_UNITS = ['', 'K', 'M', 'B', 'T']
export const shortMoney = (n) => {
  let value = n
  let unit = 0
  while (value >= 999.95 && unit < MONEY_UNITS.length - 1) {
    value /= 1000
    unit++
  }
  return `$${+value.toFixed(1)}${MONEY_UNITS[unit]}`
}
const slot = (item, i) => `<button class="hud-btn hud-slot" type="button"><i>${i + 1}</i>${item}</button>`
const tile =(cls, icon, text, alert = false) => `
  <button class="hud-btn hud-tile ${cls}" type="button" aria-label="${text}">
    ${alert ? '<span class="hud-alert">!</span>' : ''}
    <span class="hud-tile-icon">${icon}</span><span class="hud-tile-text">${text}</span>
  </button>`

export function createHud({ onTrain, onHome, onMenu }) {
  const root = document.createElement('div')
  root.className = 'hud'
  root.innerHTML = `
    <div class="hud-train"><span>TRAIN</span><b>${clock(YARD.train.interval)}</b></div>

    <div class="hud-left">
      <div class="hud-grid">
        ${tile('tile-gifts', ICONS.gift, 'Gifts', true)}
        ${tile('tile-rebirth', ICONS.rebirth, 'Rebirth')}
        ${tile('tile-settings', ICONS.gear, 'Settings')}
        ${tile('tile-index', ICONS.book, 'Index')}
      </div>
      <div class="hud-wallet">
        <div class="hud-money">${shortMoney(HUD.money)}<span class="hud-gain"></span></div>
        <div class="hud-boost">
          <span>Friend Boost: +0%</span>
        </div>
      </div>
    </div>

    <div class="hud-right">
      <button class="hud-btn hud-rush" type="button" aria-label="Rush Hour">
        <span class="hud-rays"></span>
        <span class="hud-rush-coin"><b></b></span>
        <span class="hud-rush-icon">${ICONS.sawGold}</span>
        <span class="hud-rush-title">RUSH HOUR</span>
        <span class="hud-rush-sub">x2 SPEED &amp; CASH</span>
        <span class="hud-rush-time">${SHOP.rush.seconds}s</span>
      </button>
      <button class="hud-btn hud-x2" type="button" aria-label="x2 Money">
        <span class="hud-x2-text">x2 Money</span>
        <span class="hud-x2-coin"><b></b></span>
      </button>
    </div>

    <div class="hud-bottom">
      <div class="hud-bottom-row">
        <button class="hud-btn hud-auto" type="button" aria-label="Auto Chop">
          <span class="hud-best">BEST VALUE!</span>
          <span class="hud-auto-axe">${ICONS.axe}</span>
          <span class="hud-auto-text">AUTO CHOP</span>
          <span class="hud-auto-coin"><b></b></span>
        </button>
        <button class="hud-btn hud-home" type="button" aria-label="Go to my lumber yard">MY YARD</button>
      </div>
      <div class="hud-hotbar">
        ${HUD.hotbar.map(slot).join('')}
      </div>
    </div>

    <div class="hud-fps" hidden></div>
    <div class="hud-notes">
      <div class="hud-hint" hidden></div>
      <div class="hud-toast" hidden></div>
    </div>
    <div class="hud-carry" hidden></div>`
  document.body.appendChild(root)

  const timer = root.querySelector('.hud-train b')
  let reserved = [] // Boxity's rectangles (bloxity.onReservedAreas): the layout keeps out of them
  function resize() {
    const vv = window.visualViewport
    const w = vv?.width ?? window.innerWidth
    const h = vv?.height ?? window.innerHeight
    const portrait = h >= w
    const toolbar = reserved.find((a) => a.id === 'toolbar')
    const chat = reserved.find((a) => a.id === 'chat')
    const u = Math.max(MIN_SCALE, portrait ? Math.min(w / REF.portraitW, 1) : Math.min(w / REF.w, h / REF.h, 1.3))
    const toolbarBottom = toolbar ? toolbar.top + toolbar.height : 0
    const chatRight = chat ? chat.left + chat.width : 0
    const px = {
      '--u': u,
      // On a tall screen the right column has only what the chat feed leaves it.
      '--ur': portrait ? Math.min(u, (w - chatRight - RIGHT_MARGIN) / RIGHT_WIDTH) : u,
      '--res-top': toolbarBottom,
      '--res-tool-r': toolbar ? toolbar.left + toolbar.width : 0,
      '--res-chat-b': chat ? chat.top + chat.height : toolbarBottom,
      '--res-chat-r': chatRight,
    }
    for (const [name, value] of Object.entries(px)) root.style.setProperty(name, `${value}px`)
  }
  window.addEventListener('resize', resize)
  window.visualViewport?.addEventListener('resize', resize)
  resize()

  const wallet = root.querySelector('.hud-money')
  const walletText = wallet.firstChild
  const gain = root.querySelector('.hud-gain')
  const hint = root.querySelector('.hud-hint')
  const toast = root.querySelector('.hud-toast')
  const carry = root.querySelector('.hud-carry')
  let toastLeft = 0
  let gained = 0
  let gainLeft = 0
  const hotbar = root.querySelector('.hud-hotbar')
  const giftAlert = root.querySelector('.tile-gifts .hud-alert')
  let cash = UNLIMITED_MONEY ? DEV_MONEY : HUD.money
  walletText.textContent = shortMoney(cash)
  let crates = 0
  let crateSlot = null

  const axeSlot = hotbar.firstElementChild
  axeSlot.classList.add('on')
  axeSlot.addEventListener('click', () => out.onAxe?.())
  root.querySelector('.hud-home').addEventListener('click', () => onHome?.())
  root.querySelector('.tile-settings').addEventListener('click', () => onMenu?.())
  const friendText = root.querySelector('.hud-boost span')
  let friendPercent = 0
  const fps = root.querySelector('.hud-fps')
  let fpsFrames = 0
  let fpsTime = 0

  const perks = {}
  for (const [id, cls] of [['rush', 'rush'], ['x2Money', 'x2'], ['autoChop', 'auto']]) {
    perks[id] = root.querySelector(`.hud-${cls}-coin b`)
    root.querySelector(`.hud-${cls}`).addEventListener('click', () => out.onPerk?.(id))
  }

  let left = YARD.train.interval
  let shown = left
  const out = {
    root,
    onPerk: null,
    onAxe: null,
    setAxe(on) {
      axeSlot.classList.toggle('on', on)
    },
    setReserved(areas) {
      reserved = areas
      resize()
    },
    showFps(on) {
      fps.hidden = !on
    },
    // n Bloxity friends in the room.
    setFriends(n) {
      const next = n * HUD.friendBoost
      if (next === friendPercent) return
      friendPercent = next
      friendText.textContent = `Friend Boost: +${next}%`
    },
    // What the Friend Boost multiplies a sale by.
    get friendCash() {
      return 1 + friendPercent / 100
    },
    // The price tag of a perk button, or what it shows instead once bought.
    showPerk(id, text) {
      if (perks[id].textContent !== text) perks[id].textContent = text
    },
    get money() {
      return cash
    },
    addMoney(n) {
      if (UNLIMITED_MONEY) return
      cash += n
      walletText.textContent = shortMoney(cash)
    },
    // From a save.
    setMoney(n) {
      out.addMoney(n - cash)
    },
    get crates() {
      return crates
    },
    // Money earned: adds it and shows the running total of this streak beside the wallet.
    earn(n) {
      this.addMoney(n)
      career.earned += n
      gained += n
      gainLeft = 1.4
      gain.textContent = `+${shortMoney(gained)}`
      gain.classList.add('on')
    },
    setHint(text) {
      hint.hidden = !text
      if (text && hint.textContent !== text) hint.textContent = text
    },
    notify(text) {
      toast.textContent = text
      toast.hidden = false
      toastLeft = 2.4
    },
    setCarry(n, max) {
      carry.hidden = n === 0
      carry.textContent = `${n}/${max}`
      carry.classList.toggle('full', n >= max)
    },
    addCrates(n, name) {
      if (!n) return
      crates += n
      if (!crateSlot) {
        hotbar.insertAdjacentHTML('beforeend', slot(name, hotbar.children.length))
        crateSlot = hotbar.lastElementChild.lastChild
      }
      crateSlot.textContent = `${name} x${crates}`
    },
    setGiftAlert(on) {
      giftAlert.style.display = on ? '' : 'none'
    },
    update(dt) {
      if (!fps.hidden) {
        fpsFrames++
        if ((fpsTime += dt) >= 0.5) {
          fps.textContent = `${Math.round(fpsFrames / fpsTime)} FPS`
          fpsFrames = fpsTime = 0
        }
      }
      if (toastLeft > 0 && (toastLeft -= dt) <= 0) toast.hidden = true
      if (gainLeft > 0 && (gainLeft -= dt) <= 0) {
        gained = 0
        gain.classList.remove('on')
      }
      left -= dt
      if (left <= 0) {
        left = YARD.train.interval
        onTrain()
      }
      const whole = Math.ceil(left)
      if (whole !== shown) {
        shown = whole
        timer.textContent = clock(whole)
      }
    },
  }
  return out
}
