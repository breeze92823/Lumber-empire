import { WINDOWS } from '../config.js'
import { ART, figure } from './art.js'
import { createWindow } from './shell.js'

// The Index window: every worker kind, ??? until the player owns one.
const { list, note } = WINDOWS.index
const owned = list.filter((w) => w.owned).length

const card = (w) => `
  <div class="ix-card r-${w.rarity.toLowerCase()}">
    <h4>${w.name ?? '???'}</h4>
    <span class="ix-fig">${figure(w)}</span>
    <b class="ix-mult">x${w.mult} money</b>
    <span class="ix-rarity">${w.rarity}${w.owned > 1 ? ` x${w.owned}` : ''}</span>
  </div>`

export function createCollection() {
  const win = createWindow({ title: 'Index', icon: ART.book, className: 'w-index' })
  win.body.innerHTML = `
    <div class="uiw-well ix-well"><div class="ix-grid">${list.map(card).join('')}</div></div>
    <div class="uiw-foot ix-foot">
      <p>${note}</p>
      <div class="ix-count"><span>Collected</span><b>${owned}/${list.length}</b></div>
    </div>`
  return { open: win.open }
}
