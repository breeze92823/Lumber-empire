import { AIR, GAME } from '../config.js'
import { shortMoney } from '../hud.js'
import { stats, upgradeCost, upgradeLevel } from '../stats.js'
import { createWindow, replay } from './shell.js'

// The HANGAR ring's window, the Truck Depot's twin (same frame, same CSS): Aircraft Level and Flight
// Time. The picture is the plane the next level buys, or the last one once it is bought.
const levels = GAME.aircraft
const seconds = (s) => `${+s.toFixed(1)}s`
const specs = (t) => `${t.name}: ${t.items} items, ${t.bonus}% full load bonus`

const row = (id, title, cls) => `
  <div class="dp-row ${cls}" data-id="${id}">
    <h3>${title}</h3>
    <p></p>
    <span class="dp-pips">${'<i></i>'.repeat(GAME.upgrades[id].max)}</span>
    <button class="dp-buy uiw-tap" type="button"></button>
  </div>`

export function createHangar(hud, buy, openLinks) {
  const win = createWindow({ title: 'Hangar', className: 'w-depot', onOpen: render })
  win.body.innerHTML = `
    <div class="dp-top">
      <span class="dp-face"></span>
      <div class="dp-rows">${row('aircraft', 'Aircraft', 'level')}${row('flightTime', 'Flight Time', 'delivery')}</div>
    </div>
    <p class="dp-lucky">AIR FREIGHT PAYS <span class="gold">x${AIR.premium} TRUCK PRICES</span></p>
    <p class="dp-next"></p>
    <button class="dp-air uiw-tap" type="button">AIR LINKS</button>`
  win.body.querySelector('.dp-air').addEventListener('click', () => {
    win.close()
    openLinks()
  })
  const face = win.body.querySelector('.dp-face')
  const next = win.body.querySelector('.dp-next')
  const rows = [...win.body.querySelectorAll('.dp-row')].map((el) => ({
    id: el.dataset.id,
    sub: el.querySelector('p'),
    pips: [...el.querySelector('.dp-pips').children],
    button: el.querySelector('.dp-buy'),
  }))
  let shown = -1 // the money the buttons were last priced against
  let portraits = []

  const nextPlane = () => (upgradeCost('aircraft') == null ? null : levels[stats.aircraft + 1])

  function subline(id) {
    if (id === 'aircraft') {
      const after = nextPlane()
      return after ? `> ${after.name}` : levels[stats.aircraft].name
    }
    const now = seconds(stats[id])
    return upgradeCost(id) == null ? `${now} (MAX)` : `${now} > ${seconds(stats[id] + GAME.upgrades[id].step)}`
  }

  function render() {
    shown = hud.money
    for (const { id, sub, pips, button } of rows) {
      const cost = upgradeCost(id)
      sub.textContent = subline(id)
      pips.forEach((pip, i) => pip.classList.toggle('on', i < upgradeLevel(id)))
      button.textContent = cost == null ? 'MAX' : shortMoney(cost)
      button.classList.toggle('max', cost == null)
      button.classList.toggle('can', cost != null && hud.money >= cost)
    }
    const after = nextPlane()
    next.textContent = after ? `Next: ${specs(after)}` : specs(levels[stats.aircraft])
    face.replaceChildren(portraits[stats.aircraft + (after ? 1 : 0)])
  }

  for (const { id, button } of rows) {
    button.addEventListener('click', () => {
      if (buy(id) === 'deny') replay(button, 'uiw-shake')
      render()
    })
  }

  return {
    open: win.open,
    close: win.close,
    setPortraits(list) {
      portraits = list
    },
    update() {
      if (win.isOpen() && hud.money !== shown) render()
    },
  }
}
