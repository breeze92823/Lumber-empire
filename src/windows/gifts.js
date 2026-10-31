import * as sfx from '../audio/sfx.js'
import { SHOP, WINDOWS } from '../config.js'
import { clock, shortMoney } from '../hud.js'
import { ART } from './art.js'
import { createWindow, replay } from './shell.js'

// Play-time rewards. Each card counts down the seconds online it still needs, then shows
// CLAIM!. The clock only runs while the game is open; once every gift is claimed it starts over.
const { crateName, played, rows } = WINDOWS.gifts
const openAllCost = SHOP.allGifts.money
const gifts = rows.flat().sort((a, b) => a.at - b.at)
const PRESENT = { mint: ART.presentPink, pink: ART.presentPink, green: ART.presentGreen, blue: ART.presentBlue }

const prize = (g) => [g.money && shortMoney(g.money), g.crates && 'CRATE'].filter(Boolean).join(' + ')

function card(g) {
  return `<button class="gf-card tone-${g.tone} uiw-tap" type="button">
    <span class="gf-box">${PRESENT[g.tone]}</span>
    <span class="gf-prize${g.crates ? ' crate' : ''}">${prize(g)}</span>
    <b class="gf-state"></b>
  </button>`
}

export function createGifts(hud) {
  let time = played
  let shown = -1
  const claimed = new Set()
  const ready = (g) => !claimed.has(g) && time >= g.at

  const win = createWindow({
    title: 'Gifts',
    icon: ART.gift,
    extra: `<button class="gf-robux uiw-tap" type="button" aria-label="Open every gift for ${shortMoney(openAllCost)}"><b>${shortMoney(openAllCost)}</b></button>`,
    className: 'w-gifts',
    onOpen: render,
  })
  win.body.innerHTML = `
    <div class="gf-grid">
      ${rows.map((row) => `<div class="gf-row">${row.map(card).join('')}</div>`).join('')}
    </div>
    <div class="uiw-foot gf-foot">
      <div class="gf-next">
        <p class="gf-next-text"></p>
        <div class="gf-bar"><i></i><b></b></div>
      </div>
      <button class="gf-all uiw-tap" type="button">Claim All</button>
    </div>`
  const cards = [...win.body.querySelectorAll('.gf-card')]
  const entries = rows.flat().map((g, i) => ({ g, el: cards[i], state: cards[i].querySelector('.gf-state') }))
  const nextText = win.body.querySelector('.gf-next-text')
  const barFill = win.body.querySelector('.gf-bar i')
  const barTime = win.body.querySelector('.gf-bar b')
  const claimAll = win.body.querySelector('.gf-all')

  function claim(list) {
    sfx.gift()
    for (const g of list) {
      claimed.add(g)
      hud.addMoney(g.money ?? 0)
      hud.addCrates(g.crates ?? 0, crateName)
    }
    if (claimed.size === gifts.length) {
      claimed.clear()
      time = 0
    }
    render()
  }

  function render() {
    for (const { g, el, state } of entries) {
      const done = claimed.has(g)
      el.classList.toggle('claimed', done)
      el.classList.toggle('ready', ready(g))
      state.textContent = done ? 'CLAIMED' : ready(g) ? 'CLAIM!' : clock(Math.ceil(g.at - time))
    }
    const next = gifts.find((g) => g.at > time && !claimed.has(g))
    const left = next ? clock(Math.ceil(next.at - time)) : ''
    const from = next ? (gifts.findLast((g) => g.at <= time)?.at ?? 0) : 0
    nextText.textContent = next ? `Next gift in ${left}` : 'All gifts ready!'
    barTime.textContent = left
    barFill.style.width = `${next ? ((time - from) / (next.at - from)) * 100 : 100}%`
  }

  entries.forEach(({ g, el }) =>
    el.addEventListener('click', () => (ready(g) ? claim([g]) : replay(el, 'uiw-shake'))),
  )
  claimAll.addEventListener('click', () => {
    const list = gifts.filter(ready)
    if (list.length) claim(list)
    else replay(claimAll, 'uiw-shake')
  })
  const openAll = win.overlay.querySelector('.gf-robux')
  openAll.addEventListener('click', () => {
    if (hud.money < openAllCost) return replay(openAll, 'uiw-shake')
    hud.addMoney(-openAllCost)
    claim(gifts.filter((g) => !claimed.has(g)))
  })

  return {
    open: win.open,
    snapshot: () => ({ giftTime: Math.floor(time), giftsClaimed: [...claimed].map((g) => gifts.indexOf(g)) }),
    hydrate(doc) {
      time = doc.giftTime ?? time
      claimed.clear()
      for (const i of doc.giftsClaimed ?? []) if (gifts[i]) claimed.add(gifts[i])
      shown = -1
    },
    update(dt) {
      time += dt
      const whole = Math.floor(time)
      if (whole === shown) return
      shown = whole
      hud.setGiftAlert(gifts.some(ready))
      if (win.isOpen()) render()
    },
  }
}
