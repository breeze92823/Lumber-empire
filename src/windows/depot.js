import { GAME, WINDOWS } from '../config.js'
import { shortMoney } from '../hud.js'
import { stats, upgradeCost, upgradeLevel } from '../stats.js'
import { createWindow, replay } from './shell.js'

// The UPGRADE ring's window: Truck Level (what a truck carries and its full load bonus) and
// Delivery Time. buy(id) spends through the game and answers 'buy' or 'deny'. The picture is the
// truck the next level buys (setPortraits), or the last one once it is bought.
const { levels } = GAME.trucks
const seconds = (s) => `${+s.toFixed(1)}s`
const specs = (t) => `${t.name}: ${t.items} items, ${t.bonus}% full load bonus`

const row = (id, title, cls) => `
  <div class="dp-row ${cls}" data-id="${id}">
    <h3>${title}</h3>
    <p></p>
    <span class="dp-pips">${'<i></i>'.repeat(GAME.upgrades[id].max)}</span>
    <button class="dp-buy uiw-tap" type="button"></button>
  </div>`

export function createDepot(hud, buy) {
  const win = createWindow({ title: 'Truck Depot', className: 'w-depot', onOpen: render })
  win.body.innerHTML = `
    <div class="dp-top">
      <span class="dp-face"></span>
      <div class="dp-rows">${row('truckLevel', 'Truck Level', 'level')}${row('delivery', 'Delivery Time', 'delivery')}</div>
    </div>
    <p class="dp-lucky">LUCKY TRUCKS:${WINDOWS.depot.lucky.map((l) => ` <span class="${l.name.toLowerCase()}">${l.name} ${l.chance}% = x${l.mult}</span>`).join('')}</p>
    <p class="dp-next"></p>`
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

  // The truck the next level buys. The OP Truck is SHOP's, so the last level has none.
  const nextTruck = () => (upgradeCost('truckLevel') == null ? null : levels[stats.truckLevel + 1])

  function subline(id) {
    if (id === 'truckLevel') {
      const after = nextTruck()
      return after ? `> ${after.name}` : levels[stats.truckLevel].name
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
    const after = nextTruck()
    next.textContent = after ? `Next: ${specs(after)}` : specs(levels[stats.truckLevel])
    face.replaceChildren(portraits[stats.truckLevel + (after ? 1 : 0)])
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
