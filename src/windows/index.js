import { YARD } from '../config.js'
import { player } from '../player.js'
import { createCollection } from './collection.js'
import { createDepot } from './depot.js'
import { createGifts } from './gifts.js'
import { createHire } from './hire.js'
import { createRebirth } from './rebirth.js'

export { closeTopWindow, setWindowReserved } from './shell.js'

// The game's popup windows. The HUD tiles open Gifts, Rebirth and Index; walking onto the HIRE
// or UPGRADE ring opens its window and walking off closes it, so no key is needed on any device.
export function createWindows(hud, onHire, buyUpgrade, onRebirth) {
  const gifts = createGifts(hud)
  const hire = createHire(hud, onHire)
  const rebirth = createRebirth(hud, (n, skipped) => {
    hire.raiseMax()
    onRebirth(n, skipped)
  })
  const collection = createCollection()
  const depot = createDepot(hud, buyUpgrade)

  const tiles = { '.tile-gifts': gifts, '.tile-rebirth': rebirth, '.tile-index': collection }
  for (const [selector, win] of Object.entries(tiles)) {
    hud.root.querySelector(selector).addEventListener('click', win.open)
  }

  const rings = [['HIRE', hire], ['UPGRADE', depot]].map(([text, win]) => ({ win, ring: YARD.rings.find((r) => r.text === text), on: false }))
  return {
    gifts,
    rebirth,
    collection,
    hire,
    depot,
    snapshot: () => ({ ...hire.snapshot(), ...gifts.snapshot() }),
    hydrate(doc) {
      rebirth.hydrate(doc.rebirths ?? 0)
      hire.hydrate(doc)
      gifts.hydrate(doc)
    },
    update(dt) {
      gifts.update(dt)
      depot.update()
      for (const r of rings) {
        const now = Math.hypot(player.position.x - r.ring.x, player.position.z - r.ring.z) < r.ring.r
        if (now === r.on) continue
        r.on = now
        if (now) r.win.open()
        else r.win.close()
      }
    },
  }
}
