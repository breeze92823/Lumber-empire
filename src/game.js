import { GAME, WINDOWS, YARD } from './config.js'
import { inputState } from './input.js'
import { registerZone } from './interact.js'
import { player, respawn } from './player.js'
import { createShop } from './shop.js'
import { book, career, raiseUpgrade, stats, upgradeCost } from './stats.js'
import { createPlot } from './yard/plot.js'
import * as sfx from './audio/sfx.js'

// The rules on top of the yard: the player's axe and hands, what the floor rings do, spending
// money on the boards and signs, and the Halloween haunting. The world's own machinery (trees
// regrowing, belts, workers, trucks) lives in yard/ and runs by itself.
const noticeGap = 3 // s before the same complaint can show again

export function createGame({ yard, hud }) {
  const { air, boards, forest, items, lines, train, trucks } = yard
  const [line] = lines
  const { stages } = line
  const sales = new Map(YARD.saleSigns.map((s) => [s.id, s]))
  const trainRing = YARD.rings.find((r) => r.text === 'TRAIN')
  const shop = createShop({ yard, hud })
  const plot = createPlot(yard, {
    book,
    notify: hud.notify,
    setBelts: (k) => shop.setBelts(k),
    onWipe: () => shop.keep(),
    onFloor: (n) => out.onFloor?.(n),
  })
  const { buyRings, cargoRings, logsRings, owned, sellRings } = plot

  const carried = []
  let axeOn = true
  let swingLeft = 0
  let swingTree = null
  let struck = false
  let handsLeft = 0 // s until the next item can move in or out of the hands
  let priceCheck = 0
  let nearTree = false
  let sold = false
  const told = new Map() // complaint -> s left before it may repeat

  const carryMax = () => Math.max(stats.carry, out.tutorialCarry)

  function complain(text) {
    if (told.has(text)) return
    told.set(text, noticeGap)
    hud.notify(text)
  }

  // --- Spending -------------------------------------------------------------------
  function afterUpgrade(id) {
    if (id === 'walkSpeed') player.speedScale = stats.walkSpeed * GAME.speedPerPoint
    if (id === 'truckLevel') {
      trucks.repaint()
      trucks.refit()
      hud.notify(`New truck: ${GAME.trucks.levels[stats.truckLevel].name}!`)
    }
    if (id === 'aircraft') {
      const swapped = air.planes.refit()
      if (swapped) sfx.reward()
      hud.notify(`New aircraft: ${GAME.aircraft[stats.aircraft].name}!${swapped ? '' : ' It comes in on the next flight'}`)
    }
    boards.repaint()
    boards.refreshPrices(hud.money)
  }

  // Tries to buy a sign's item: 'buy' or 'deny'.
  function purchase(id) {
    const sale = sales.get(id)
    if (owned.has(id) || plot.rebirths < (sale.rebirth ?? 0)) return 'deny'
    const missing = [sale.needs, sale.also].flat().find((need) => need && !owned.has(need))
    if (missing) {
      complain(`Buy the ${sales.get(missing).title} first`)
      return 'deny'
    }
    if (hud.money < sale.cost) {
      complain(`${sale.title} costs ${sale.price}`)
      return 'deny'
    }
    hud.addMoney(-sale.cost)
    plot.buy(id)
    boards.refreshPrices(hud.money)
    return 'buy'
  }

  function upgrade(id) {
    const cost = upgradeCost(id)
    if (cost == null || hud.money < cost) return 'deny'
    hud.addMoney(-cost)
    raiseUpgrade(id)
    afterUpgrade(id)
    return 'buy'
  }

  forest.onHit = (t) => sfx.chop(t.x, t.z)
  forest.onFell = (t) => sfx.creak(t.x, t.z)
  forest.onDown = (t) => sfx.fall(t.x, t.z)
  items.onLand = (item, at) => sfx.land(item.kind, at.x, at.y, at.z)

  // --- The axe ----------------------------------------------------------------------
  function updateAxe(dt) {
    const p = player.position
    const tree = forest.near(p.x, p.z, GAME.reach)
    const open = tree && !tree.locked
    if (!!open !== nearTree) {
      nearTree = !!open
      out.onNearTree?.(nearTree)
    }
    if (swingLeft > 0) {
      swingLeft -= dt
      const done = 1 - swingLeft / GAME.swingTime
      if (!struck && done >= GAME.hitAt) {
        struck = true
        if (swingTree?.state === 'up') forest.hit(swingTree, stats.axe, p.x, p.z)
      }
      if (swingLeft <= 0) swingLeft = 0
      return
    }
    if (!tree || !(inputState.chop || (shop.autoChop && !tree.locked))) return
    if (!axeOn) {
      if (inputState.chop) complain('Equip your axe first (slot 1)')
      return
    }
    if (tree.locked) {
      complain(`Buy ${sales.get('moreForest').title} to chop here`)
      return
    }
    swingTree = tree
    swingLeft = GAME.swingTime
    struck = false
    player.facing = Math.atan2(tree.x - p.x, tree.z - p.z)
  }

  // --- The hands --------------------------------------------------------------------
  const hands = { x: 0, y: 1.3, z: 0 }
  const floorAt = (y) => Math.min(lines.length - 1, Math.max(0, Math.round(y / YARD.floors.y)))
  const lastLog = () => {
    for (let i = carried.length - 1; i >= 0; i--) if (carried[i].kind === 'log') return i
    return -1
  }

  function updateHands(dt) {
    const p = player.position
    hands.x = p.x
    hands.y = p.y + 1.3
    hands.z = p.z
    const level = floorAt(p.y)
    const here = lines[level]
    const room = carryMax() - carried.length
    const log = level ? null : forest.nearestLog(p.x, p.z, GAME.pickupRange)
    if (log) {
      if (room > 0) {
        carried.push(forest.takeLog(log))
        sfx.pick()
      } else {
        complain(`Your hands are full (${carryMax()}): upgrade Carry Capacity`)
      }
    }

    handsLeft -= dt
    if (handsLeft > 0) return
    // No conveyor from the machine before: goods carried here go on this machine's belt.
    for (const s of here.stages.slice(1)) {
      const before = here.stages[s.index - 1]
      if (!s.owned || before.linked) continue
      const at = carried.map((c) => c.kind).lastIndexOf(before.out)
      if (at < 0 || Math.hypot(s.inlet.x - p.x, s.inlet.z - p.z) > GAME.dockRange) continue
      if (here.handIn(s.index, carried[at], hands)) {
        carried.splice(at, 1)
        handsLeft = GAME.loadEvery
        sfx.pick()
      }
      return
    }
    for (const s of here.stages) {
      if (!s.owned || !s.stock.length || carried.length >= carryMax()) continue
      if (Math.hypot(s.pallet.x - p.x, s.pallet.z - p.z) > GAME.dockRange) continue
      carried.push(s.stock.pop())
      handsLeft = GAME.loadEvery
      sfx.pick()
      return
    }

    const logAt = lastLog()
    // The airstrip's two CARGO rings: the pile, and the hopper once the Tunnel Conveyor stands.
    if (air?.open && logAt >= 0) {
      const inside = (ring) => Math.hypot(ring.x - p.x, ring.z - p.z) < ring.r + 0.4
      const toBelt = air.belted && inside(cargoRings.belt)
      if (toBelt || inside(cargoRings.pile)) {
        if (toBelt ? air.tipBelt(carried[logAt]) : air.tipPile(carried[logAt], hands)) {
          carried.splice(logAt, 1)
          handsLeft = GAME.loadEvery
          sfx.pick()
        } else if (air.room <= 0) {
          complain('The cargo pile is full: wait for the plane')
        }
        return
      }
    }
    const logsRing = logsRings[level]
    if (here.stages[0].owned && logAt >= 0 && Math.hypot(logsRing.x - p.x, logsRing.z - p.z) < logsRing.r + 0.4) {
      if (here.feed(carried[logAt], hands)) {
        carried.splice(logAt, 1)
        handsLeft = GAME.loadEvery
        sfx.pick()
        out.onPiled?.()
      } else {
        complain('The log pile is full')
      }
      return
    }

    if (level) return
    if (carried.length && train.accepting && Math.hypot(trainRing.x - p.x, trainRing.z - p.z) < trainRing.r + 0.4) {
      train.load(carried.pop(), hands)
      handsLeft = GAME.loadEvery
      return
    }

    for (const ring of sellRings) {
      if (!carried.length || Math.hypot(ring.x - p.x, ring.z - p.z) >= ring.r + 0.4) continue
      const truck = trucks.list[ring.sell]
      if (!truck.owned) continue
      if (!truck.ready) {
        complain(`The truck is away, back in ${Math.ceil(truck.left)}s`)
        return
      }
      trucks.sell(carried.pop(), truck, hands)
      sfx.sell()
      handsLeft = GAME.loadEvery
      return
    }
  }

  function drawCarried() {
    const p = player.renderPosition
    const yaw = player.facing
    const fx = Math.sin(yaw) * 0.85
    const fz = Math.cos(yaw) * 0.85
    let y = p.y + 1.15
    for (const item of carried) {
      const r = items.rest(item) * 0.7
      items.add(item, p.x + fx, y + r, p.z + fz, yaw + Math.PI / 2, 0.7)
      y += r * 2
    }
  }

  // Buy rings: standing in one shows "Press E to buy X"; holding E buys it (a click on its sign still does too).
  const ringAt = () => {
    const p = player.position
    const level = floorAt(p.y)
    return buyRings.find((r) => !r.off && (r.spec.floor ?? 0) === level && Math.hypot(r.spec.x - p.x, r.spec.z - p.z) < r.spec.r)
  }
  registerZone({
    id: 'buyRing',
    isNear: () => !!ringAt(),
    label() {
      const sale = sales.get(ringAt()?.spec.buy)
      return sale ? `buy ${sale.title} (${sale.price})` : null
    },
    onConfirm() {
      const ring = ringAt()
      if (ring) sfx[purchase(ring.spec.buy)]()
    },
  })

  function updateHint() {
    let hint = null
    if (!sold && !out.tutorialCarry) {
      const debarker = stages[0].owned
      if (!debarker && hud.money >= sales.get('debarker').cost) hint = 'buy'
      else if (!debarker && carried.length) hint = 'sellLogs'
      else if (carried.some((c) => c.kind === 'log')) hint = 'load'
      else if (carried.length) hint = 'sell'
      else if (forest.ground.length) hint = 'pick'
      else if (line.anything) hint = 'wait'
      else hint = 'chop'
    }
    hud.setHint(hint && GAME.hints[hint])
  }

  trucks.onSold = (value) => {
    if (stages[0].owned) sold = true // raw logs sold before the Debarker are part of the lesson, not its end
    out.onSold?.()
    hud.earn(Math.round(value * shop.cash))
  }
  train.onDocked = () => hud.notify(`The train is in! Its load pays x${YARD.train.pay}`)
  train.onLeft = (value, count) => {
    const paid = Math.round(value * shop.cash)
    hud.earn(paid)
    hud.notify(`The train left with ${count} items: +$${paid.toLocaleString('en-US')}`)
    sfx.sell()
  }
  trucks.onLucky = ({ name, mult }) => hud.notify(`A ${name} TRUCK pulled in! Everything on it pays x${mult}`)
  if (air) {
    air.planes.onFlight = ({ value, count, name, full }) => {
      const paid = Math.round(value * shop.cash)
      hud.earn(paid)
      hud.notify(`${name} is away with ${count} items${full ? ', a full load' : ''}: +$${paid.toLocaleString('en-US')}`)
    }
    air.planes.onDocked = () => hud.notify('The freighter is on the stand: load it up')
  }

  // A real rebirth: the whole plot goes. Skipping one for money keeps it.
  function wipePlot() {
    for (const id of ['secondFloor', 'thirdFloor']) if (owned.has(id)) out.onFloor?.(-YARD.floors.workers)
    player.speedScale = 1
    respawn() // off the plot: a locked truck is about to park back in its bay
    carried.length = 0
    swingLeft = 0
    plot.wipe()
  }

  // Slot 1. Off, there's no axe in the hand and no chopping.
  function setAxe(on) {
    axeOn = on
    if (!on) swingLeft = 0
    hud.setAxe(on)
  }
  hud.onAxe = () => {
    setAxe(!axeOn)
    sfx.toggle(axeOn)
  }

  const out = {
    onNearTree: null,
    onFloor: null,
    onSold: null,
    onPiled: null,
    tutorialCarry: 0, // logs the hands hold while the tutorial runs (tutorial.js), 0 after it
    setAxe,
    toggleAxe: hud.onAxe,
    get axeOn() {
      return axeOn
    },
    get carrying() {
      return carried.length > 0
    },
    get logsHeld() {
      return carried.reduce((n, c) => n + (c.kind === 'log' ? 1 : 0), 0)
    },
    get swing() {
      return swingLeft > 0 ? 1 - swingLeft / GAME.swingTime : 0
    },
    // What the hands hold, for the others to draw.
    get carried() {
      return { kind: carried[0]?.kind ?? '', count: carried.length }
    },
    onDraw: null, // lists more items each frame (the other players' hands)
    plot,
    // The yard as a neighbour rebuilds it.
    plotState: () => plot.state(),
    // This player's part of a save.
    snapshot: () => ({ owned: [...owned], upgrades: book.upgradeLevels(), rebirths: plot.rebirths, perks: shop.perks() }),
    // A loaded save over whatever stands: the yard as it was left.
    hydrate(doc) {
      career.rebirths = doc.rebirths ?? 0
      carried.length = 0
      plot.load({ owned: doc.owned, levels: doc.upgrades, rebirths: doc.rebirths })
      shop.restore(doc.perks ?? [], doc.upgrades?.truckLevel)
      plot.setPerks(doc.perks ?? [])
      player.speedScale = stats.walkSpeed * GAME.speedPerPoint
      boards.repaint()
      boards.refreshPrices(hud.money)
    },
    // What the crew makes a second with nobody watching: the logs it can gather, shared between
    // the walks no conveyor saves it, as far as the machines and the trucks keep up, at the price of
    // what each line ends in. Boosts that run out don't count.
    crewIncome() {
      const crew = yard.workers.crew.length
      if (!crew) return 0
      const { trip, share } = GAME.offline
      const truck = GAME.trucks.levels[stats.truckLevel]
      const bays = trucks.list.filter((t) => t.owned).length
      const walks = 1 + stages.filter((s) => s.owned && !s.linked).length
      const gathered = (crew * stats.workerCarry * stats.workerSpeed * GAME.workerSpeedPerPoint) / trip / walks
      const carried = (bays * truck.items) / ((2 * GAME.trucks.drive + stats.delivery) * (truck.trip ?? 1))
      let left = Math.min(gathered, carried)
      let income = 0
      for (const l of lines) {
        const run = l.stages.filter((s) => s.owned)
        if (l.floor && !run.length) continue
        const made = Math.min(left, ...run.map((s) => (s.speed * yard.sky.boost) / s.time))
        income += made * GAME.products[run.at(-1)?.out ?? 'log'].value
        left -= made
      }
      return income * (1 + truck.bonus / 100) * trucks.cash * shop.lastingCash * share
    },
    // A board button or sign was clicked: 'buy', 'deny' or 'press' (nothing to pay for).
    upgrade,
    press(button) {
      if (button.sale) return purchase(button.sale)
      if (button.row) return upgrade(button.row.id)
      return 'press'
    },
    // The window has taken the money. Every sale pays more from now on, and the Rebirth 1 slot
    // opens as a Workshop silhouette to buy. `skipped` = bought with money, no reset.
    rebirth(count, skipped) {
      career.rebirths = count
      sfx.rebirth()
      if (!skipped) wipePlot()
      plot.setRebirths(count)
      hud.addCrates(1, WINDOWS.gifts.crateName)
      boards.repaint()
      boards.refreshPrices(hud.money)
    },
    update(dt, elapsed, camera) {
      for (const [text, left] of told) {
        if (left <= dt) told.delete(text)
        else told.set(text, left - dt)
      }
      items.begin()
      yard.update(dt, elapsed, camera, player.position)
      updateAxe(dt)
      updateHands(dt)
      shop.update(dt)
      drawCarried()
      out.onDraw?.(items)
      items.end(dt)
      hud.setCarry(carried.length, carryMax())
      updateHint()
      priceCheck -= dt
      if (priceCheck <= 0) {
        priceCheck = 0.25
        boards.refreshPrices(hud.money)
      }
    },
  }
  return out
}
