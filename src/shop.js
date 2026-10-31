import { ADS, SHOP, YARD } from './config.js'
import { canShowRewarded, showRewarded } from './bloxity.js'
import { clock, shortMoney } from './hud.js'
import { claimAdReward, net } from './net.js'
import { player } from './player.js'
import { setUpgrade, upgradeLevel } from './stats.js'
import * as sfx from './audio/sfx.js'

// The Gem items that aren't windows: the Hacker and OP Truck rings, the HUD's Auto Chop, x2 Money
// and Rush Hour. All cost money until Gems exist (SHOP). What is bought here survives a rebirth.
const OP_LEVEL = 4 // GAME.trucks.levels

export function createShop({ yard, hud }) {
  const { sky, stations, trucks, workers } = yard
  const owned = new Set()
  const left = { x2Money: 0, rush: 0 } // s of each boost
  const rings = YARD.rings.filter((r) => r.perk).map((spec) => ({ spec, inside: false }))
  let autoChop = false
  let belts = 1 // what x2 Conveyer Speed makes the line, before Rush Hour

  const price = (id) => SHOP[id].money * (SHOP[id].scales ? trucks.cash : 1)
  const boost = (id) => (left[id] > 0 ? SHOP[id].cash : 1)

  function applySpeed() {
    const k = left.rush > 0 ? SHOP.rush.speed : 1
    sky.boost = belts * k
    workers.pace = k
  }

  function pay(id) {
    const cost = price(id)
    if (hud.money < cost) {
      hud.notify(`${SHOP[id].title} costs ${shortMoney(cost)}`)
      sfx.deny()
      return false
    }
    hud.addMoney(-cost)
    sfx.buy()
    return true
  }

  function buyPerk(id) {
    if (owned.has(id) || !pay(id)) return
    owned.add(id)
    yard.plot?.setPerks([...owned])
    if (id === 'opTruck') {
      setUpgrade('truckLevel', OP_LEVEL)
      trucks.repaint()
      trucks.refit()
    }
    hud.notify(`${SHOP[id].title} is yours!`)
  }

  hud.onPerk = (id) => {
    if (id === 'autoChop' && owned.has(id)) {
      autoChop = !autoChop
      sfx.toggle(autoChop)
    } else if (id === 'autoChop') {
      if (!pay(id)) return
      owned.add(id)
      autoChop = true
    } else if (left[id] > 0) {
      sfx.deny()
    } else if (pay(id)) {
      left[id] = SHOP[id].seconds
      applySpeed()
    }
  }

  // FREE REWARDS: a watched ad is a stretch of x2 Money. The server asks Boxity whether the ad was
  // really watched; a Create preview's test ad can't be checked, so it just pays.
  let watching = false
  let adCheckLeft = 0
  hud.onRewards = async () => {
    if (watching) return
    if (left.x2Money > 0) return sfx.deny()
    if (!net.connected) return hud.notify('Connecting, try again in a moment')
    watching = true
    try {
      const ad = await showRewarded(ADS.placement)
      if (ad.status === 'no-fill') hud.notify('No ad right now, try again soon')
      if (ad.status !== 'completed') return
      if (ad.test || (await claimAdReward(ad.rewardToken))) {
        left.x2Money = ADS.seconds
        hud.notify(`${SHOP.x2Money.title} for ${clock(ADS.seconds)}!`)
        sfx.buy()
      } else {
        hud.notify('That ad could not be checked')
      }
    } finally {
      watching = false
    }
  }

  function updateRings() {
    const p = player.position
    for (const ring of rings) {
      const now = p.y < 1 && Math.hypot(ring.spec.x - p.x, ring.spec.z - p.z) < ring.spec.r
      if (now && !ring.inside) buyPerk(ring.spec.perk)
      ring.inside = now
    }
  }

  function updateBoosts(dt) {
    for (const id of Object.keys(left)) {
      if (left[id] <= 0) continue
      left[id] -= dt
      if (left[id] <= 0) {
        hud.notify(`${SHOP[id].title} is over`)
        applySpeed()
      }
    }
  }

  const tag = (id) => (left[id] > 0 ? clock(Math.ceil(left[id])) : shortMoney(price(id)))

  return {
    // What every sale is multiplied by right now.
    get cash() {
      return (owned.has('hacker') ? SHOP.hacker.cash : 1) * boost('x2Money') * boost('rush') * hud.friendCash
    },
    get autoChop() {
      return autoChop
    },
    // The rebirth's wipe: back to what was bought here. Call before the trucks are reset.
    keep() {
      if (owned.has('opTruck') && upgradeLevel('truckLevel') !== OP_LEVEL) setUpgrade('truckLevel', OP_LEVEL)
      this.setBelts(1)
    },
    setBelts(k) {
      belts = k
      applySpeed()
    },
    perks: () => [...owned],
    // A loaded save: what was bought here, without paying again. `level` = the saved truck level.
    restore(list, level) {
      owned.clear()
      for (const id of list) if (SHOP[id]) owned.add(id)
      autoChop = owned.has('autoChop')
      if (owned.has('opTruck') && level !== OP_LEVEL) setUpgrade('truckLevel', OP_LEVEL)
    },
    update(dt) {
      updateRings()
      updateBoosts(dt)
      if ((adCheckLeft -= dt) <= 0) {
        adCheckLeft = ADS.checkEvery
        hud.showRewards(canShowRewarded())
      }
      hud.showPerk('x2Money', tag('x2Money'))
      hud.showPerk('rush', tag('rush'))
      hud.showPerk('autoChop', owned.has('autoChop') ? (autoChop ? 'ON' : 'OFF') : shortMoney(price('autoChop')))
    },
  }
}
