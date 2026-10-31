import { WINDOWS } from '../config.js'
import { shortMoney } from '../hud.js'
import { ART } from './art.js'
import { createWindow, replay } from './shell.js'

// Trade the money for a higher tier: a rebirth clears the wallet, counts up, raises the goal
// and calls onRebirth(rebirths), which resets the plot and applies the rewards.
const tile = (icon, text, cls = '') => `<div class="rb-tile ${cls}"><span class="rb-art">${icon}</span><b>${text}</b></div>`

export function createRebirth(hud, onRebirth) {
  const { goalGrowth, unlocks } = WINDOWS.rebirth
  let goal = WINDOWS.rebirth.goal
  let rebirths = 0

  const win = createWindow({ title: 'Rebirth', icon: ART.rebirth, className: 'w-rebirth', onOpen: render })
  win.body.innerHTML = `
    <div class="uiw-well rb-well">
      <div class="rb-trade">
        <h3>Your Reward:</h3><h3>You Lose:</h3>
        <div class="rb-tray">
          ${tile(ART.cash, 'x2')}${tile(ART.worker, '+1', 'pale')}${tile(ART.crate, '+1')}
        </div>
        <div class="rb-equals"><i></i><i></i></div>
        <div class="rb-tray wide">
          ${tile(ART.cashPile, '', 'rb-lose-money')}${tile(ART.trophy, 'Whole Plot', 'small')}
        </div>
      </div>
      <p class="rb-next"></p>
      <div class="rb-bar"><i></i><b></b></div>
      <div class="rb-actions">
        <button class="rb-go uiw-tap" type="button">Rebirth</button>
        <div class="rb-count"><b></b></div>
      </div>
    </div>`
  const [loseMoney, next, fill, label, go, count] = [
    '.rb-lose-money b', '.rb-next', '.rb-bar i', '.rb-bar b', '.rb-go', '.rb-count b',
  ].map((s) => win.body.querySelector(s))

  function render() {
    const { money } = hud
    loseMoney.textContent = shortMoney(money)
    next.textContent = unlocks[rebirths] ? `NEXT REBIRTH UNLOCKS: ${unlocks[rebirths]}!` : ''
    fill.style.width = `${Math.min(money / goal, 1) * 100}%`
    label.textContent = `Money: ${shortMoney(money)}/${shortMoney(goal)}`
    count.textContent = `Rebirths: ${rebirths}`
  }

  go.addEventListener('click', () => {
    if (hud.money < goal) return replay(go, 'uiw-shake')
    hud.addMoney(-hud.money)
    rebirths++
    goal *= goalGrowth
    onRebirth(rebirths)
    render()
  })

  return {
    open: win.open,
    // From a save: the goal only depends on how many there have been.
    hydrate(count) {
      rebirths = count
      goal = WINDOWS.rebirth.goal * goalGrowth ** count
    },
  }
}
