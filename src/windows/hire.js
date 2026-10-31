import { SHOP, WINDOWS } from '../config.js'
import { shortMoney } from '../hud.js'
import { ART } from './art.js'
import { createWindow, replay } from './shell.js'

// The HIRE ring's window. onHire(count) tells the yard how big the crew is now.
export function createHire(hud, onHire) {
  const { priceGrowth } = WINDOWS.hire
  const { hireCap, hirePacks: packs } = SHOP
  let { maxWorkers, price, workers } = WINDOWS.hire

  const win = createWindow({ title: 'Hire Workers', className: 'w-hire', onOpen: render })
  win.body.innerHTML = `
    <div class="hr-packs">
      ${packs.map((p) => `
        <button class="hr-pack ${p.look} uiw-tap" type="button" aria-label="Hire ${p.n} for ${shortMoney(p.money)}">
          <b>x${p.n}</b><span class="hr-coin"><b>${shortMoney(p.money)}</b></span>
        </button>`).join('')}
    </div>
    <span class="hr-face">${ART.worker}</span>
    <p class="hr-max"></p>
    <button class="hr-buy uiw-tap" type="button"></button>
    <p class="hr-count"></p>`
  const max = win.body.querySelector('.hr-max')
  const buy = win.body.querySelector('.hr-buy')
  const count = win.body.querySelector('.hr-count')

  function render() {
    max.textContent = `Max Workers: ${maxWorkers} (Increase by Rebirthing)`
    buy.textContent = workers < maxWorkers ? shortMoney(price) : 'MAX'
    count.textContent = `Current Workers: ${workers}`
  }

  buy.addEventListener('click', () => {
    if (workers >= maxWorkers || hud.money < price) return replay(buy, 'uiw-shake')
    hud.addMoney(-price)
    workers++
    price *= priceGrowth
    onHire(workers)
    render()
  })

  win.body.querySelectorAll('.hr-pack').forEach((button, i) => {
    button.addEventListener('click', () => {
      const { n, money } = packs[i]
      if (workers + n > hireCap || hud.money < money) return replay(button, 'uiw-shake')
      hud.addMoney(-money)
      workers += n
      onHire(workers)
      render()
    })
  })

  return {
    canHire: () => workers < maxWorkers && hud.money >= price,
    open: win.open,
    close: win.close,
    raiseMax(by = 1) {
      maxWorkers += by
      render()
    },
    get workers() {
      return workers
    },
    snapshot: () => ({ workers, maxWorkers, hirePrice: price }),
    hydrate(doc) {
      workers = doc.workers ?? workers
      maxWorkers = doc.maxWorkers ?? maxWorkers
      price = doc.hirePrice ?? price
      onHire(workers)
      render()
    },
  }
}
