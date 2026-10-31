import { AIR, YARD } from '../config.js'
import { shortMoney } from '../hud.js'
import { createWindow, replay } from './shell.js'

// The LINKS ring's window: which machines send their wood to the planes. A row per stage of the line,
// a column per floor, each cell an Air Link to buy, or already running. Items only leave the line
// where the next machine can't keep up, or where the line stops. buy(id) answers 'buy' or 'deny',
// state() is { owned, floors } and says what the yard has.
const FLOORS = ['Ground', '2nd Floor', '3rd Floor']
const FLOOR_SALE = [null, 'secondFloor', 'thirdFloor']
const tag = (id, f) => (f ? `${id}@${f}` : id)

export function createLinks(hud, buy) {
  const sales = new Map(YARD.saleSigns.map((s) => [s.id, s]))
  const win = createWindow({ title: 'Air Links', className: 'w-depot w-links', onOpen: render })
  win.body.innerHTML = `
    <div class="lk-grid">
      <span></span>${FLOORS.map((f) => `<b>${f}</b>`).join('')}
      ${AIR.links.map((l) => `<em>${l.name}</em>${FLOORS.map((_, f) => `<button class="lk-cell uiw-tap" type="button" data-id="${tag(l.id, f)}" data-need="${tag(l.sale, f)}" data-floor="${FLOOR_SALE[f] ?? ''}"></button>`).join('')}`).join('')}
    </div>
    <p class="dp-next">Spare wood from each machine rides to the planes</p>`
  const cells = [...win.body.querySelectorAll('.lk-cell')].map((button) => ({ button, ...button.dataset }))
  let owned = new Set()
  let shown = -1

  function render() {
    shown = hud.money
    for (const { button, id, need, floor } of cells) {
      const sale = sales.get(id)
      const linked = owned.has(id)
      const locked = !owned.has(need) || (floor && !owned.has(floor))
      button.textContent = linked ? 'LINKED' : locked ? '--' : shortMoney(sale.cost)
      button.classList.toggle('linked', linked)
      button.classList.toggle('locked', !linked && !!locked)
      button.classList.toggle('can', !linked && !locked && hud.money >= sale.cost)
    }
  }

  for (const { button, id } of cells) {
    button.addEventListener('click', () => {
      if (owned.has(id)) return
      if (buy(id) === 'deny') replay(button, 'uiw-shake')
      render()
    })
  }

  return {
    open: win.open,
    close: win.close,
    isOpen: win.isOpen,
    setOwned(set) {
      owned = set
    },
    update() {
      if (win.isOpen() && hud.money !== shown) render()
    },
  }
}
