import { AIR, GAME, YARD } from '../config.js'

// What a yard has bought, as data: which sales stand, what each one did to the yard, and how to get
// from one state to another. The player's purchases (game.js), a loaded save and a neighbour's
// yard all go through here, so what a sale does is written once. Nothing here touches money.
const FLOOR_SALE = [null, 'secondFloor', 'thirdFloor'] // what opens each floor
const UNLOCKS = [[1, 'Rebirth 1'], [2, 'Rebirth 2'], [3, 'Rebirth 3'], [5, 'Rebirth 5']] // the padlocks a rebirth count takes off

export function createPlot(yard, { book, notify = null, setBelts = null, onWipe = null, onFloor = null }) {
  const { air, boards, feeds, fence, floors, forest, items, lifters, lines, mills, sky, stations, train, trucks } = yard
  const owned = new Set()
  const perks = new Set() // the shop's Hacker and OP Truck: they outlive a rebirth
  const buyRings = YARD.rings.filter((r) => r.buy).map((spec) => ({ spec, inside: false }))
  const sellRings = YARD.rings.filter((r) => r.sell != null)
  const logsRings = YARD.rings.filter((r) => r.logsIn) // by floor
  const cargoRings = { pile: YARD.rings.find((r) => r.cargo === 'pile'), belt: YARD.rings.find((r) => r.cargo === 'belt') }
  const hangarRing = YARD.rings.find((r) => r.text === 'HANGAR')
  const linksRing = YARD.rings.find((r) => r.text === 'LINKS')
  let rebirths = 0
  let quiet = false // replaying a state: no notices, and the crew limits come with the save

  const say = (text) => quiet || notify?.(text)
  const showRing = (spec, on) => stations.showRing(spec, on)

  function own(f, i) {
    lines[f].stages[i].owned = true
    mills[f].own(lines[f].stages[i].id)
  }
  function link(f, i) {
    lines[f].stages[i].linked = true
    mills[f].link(i)
  }
  function openFloor(f) {
    floors.show(f, true)
    mills[f].open(true)
    mills[f - 1].setCeiling(YARD.floors.y - 1.5)
    if (!quiet) onFloor?.(YARD.floors.workers)
  }
  function openBay(i) {
    trucks.list[i].own()
    showRing(sellRings.find((r) => r.sell === i), true)
  }
  function workshopTier(f, id) {
    lines[f].stages[4].out = GAME.workshopTiers[id]
    mills[f].showShop(id)
  }

  const EFFECTS = {
    sawmill: (f) => own(f, 1),
    kiln: (f) => own(f, 2),
    bundler: (f) => own(f, 3),
    workshop: (f) => own(f, 4),
    conveyor1: (f) => link(f, 0),
    conveyor2: (f) => link(f, 1),
    conveyor3: (f) => link(f, 2),
    conveyor4: (f) => link(f, 3),
    moreForest: () => forest.open('moreForest'),
    ...Object.fromEntries(
      YARD.forest.parcels.map((p, i) => [
        p.sale,
        () => {
          forest.open(p.sale)
          fence.setStage(i + 1)
          say(p.note)
        },
      ]),
    ),
    truckBay2: () => openBay(1),
    truckBay3: () => openBay(2),
    truckBay4: () => openBay(3),
    debarker(f) {
      own(f, 0)
      showRing(logsRings[f], true)
    },
    debarkerTurbo(f) {
      const [debarker] = lines[f].stages
      debarker.speed = GAME.line.turbo
      debarker.turbo = true
      debarker.sign = GAME.line.turboSign
      mills[f].showTurbo(true)
    },
    tables: (f) => workshopTier(f, 'tables'),
    beds: (f) => workshopTier(f, 'beds'),
    truckConveyor(f) {
      lines[f].stages[4].linked = true
      mills[f].showTruckBelt(true)
    },
    conveyerSpeed() {
      if (setBelts) setBelts(GAME.line.speedBoost)
      else sky.boost = GAME.line.speedBoost
    },
    feed0: () => say(feeds.build(0)),
    feed1: () => say(feeds.build(1)),
    feed2: () => say(feeds.build(2)),
    secondFloor: () => openFloor(1),
    thirdFloor: () => openFloor(2),
    lifter: (f) => lifters.set(f, 1),
    lifterFast: (f) => lifters.set(f, 2),
    lifterMax: (f) => lifters.set(f, 3),
    step0: () => lifters.setStep(0, 1),
    step1: () => lifters.setStep(1, 1),
    step2: () => lifters.setStep(2, 1),
    step3: () => lifters.setStep(3, 1),
    stepFast0: () => lifters.setStep(0, 2),
    stepFast1: () => lifters.setStep(1, 2),
    stepFast2: () => lifters.setStep(2, 2),
    stepFast3: () => lifters.setStep(3, 2),
    trainLoader() {
      train.own()
      mills[0].showTrainBelt(true)
    },
    // A neighbour's yard has none of these: its copy keeps the hatch shut.
    tunnel() {
      air?.tunnel.dig(quiet)
      say('The tunnel is open: follow it east, under the fence')
    },
    airstrip() {
      air?.buy(quiet)
      showRing(cargoRings.pile, true)
      showRing(hangarRing, true)
      say('The Airport is yours! Your first freighter is on its way in')
    },
    airBelt() {
      air?.buildBelt()
      showRing(cargoRings.belt, true)
      showRing(linksRing, true)
      say('Cargo belts built: open the LINKS ring to connect your machines to the planes')
    },
    airBeltFast: () => air?.setBoost(AIR.belt.boost),
    ...Object.fromEntries(AIR.links.map(({ id, stage }) => [id, (f) => air?.links.build(f, stage)])),
  }

  // Which signs stand right now: not bought, rebirths reached, and any `later` one's `needs` owned.
  function showSales() {
    for (const s of YARD.saleSigns) {
      const open = !s.floor || owned.has(FLOOR_SALE[s.floor])
      const on = open && !owned.has(s.id) && rebirths >= (s.rebirth ?? 0) && (!s.later || owned.has(s.needs))
      if (s.panel) continue // sold in a window, nothing stands in the world
      boards.showSign(s.id, on)
      const ring = buyRings.find((r) => r.spec.buy === s.id)
      ring.off = !on
      showRing(ring.spec, on)
      trucks.showParked(s.id, !on && !owned.has(s.id))
    }
  }

  function hideExtraRings() {
    for (const ring of sellRings) if (ring.sell > 0) showRing(ring, false)
    for (const ring of logsRings) showRing(ring, false)
    for (const ring of [cargoRings.pile, cargoRings.belt, hangarRing, linksRing]) showRing(ring, false)
  }

  function apply(id) {
    const [effect, floor = 0] = id.split('@')
    if (!EFFECTS[effect] || owned.has(id)) return
    owned.add(id)
    EFFECTS[effect](Number(floor))
  }

  function setSigns(signs) {
    if (!Array.isArray(signs)) return
    let i = 0
    for (const l of lines) {
      for (const s of l.stages) {
        const bits = signs[i++] ?? 3
        s.workers = !!(bits & 1)
        s.next = !!(bits & 2)
      }
    }
    for (const m of mills) m.repaintSigns()
  }

  const plot = {
    owned,
    perks,
    buyRings,
    sellRings,
    logsRings,
    cargoRings,
    get rebirths() {
      return rebirths
    },
    showSales,
    // A sale has been paid for (or a neighbour bought it).
    buy(id) {
      apply(id)
      showSales()
    },
    setRebirths(count) {
      rebirths = count
      trucks.cash = GAME.rebirthCash ** count
      for (const [needs, text] of UNLOCKS) stations.unlock(text, count >= needs)
      showSales()
    },
    // The whole plot goes: back to one Debarker sign and a row of silhouettes.
    wipe() {
      owned.clear()
      book.resetUpgrades()
      items.clear()
      for (const l of lines) l.reset()
      sky.reset()
      onWipe?.()
      feeds.reset()
      for (const m of mills) m.reset()
      for (const m of mills.slice(1)) m.open(false)
      lifters.reset()
      train.reset()
      forest.reset()
      fence.setStage(0)
      trucks.reset()
      air?.reset()
      yard.workers.clear()
      floors.reset()
      hideExtraRings()
    },
    setPerks(list) {
      for (const id of ['hacker', 'opTruck']) {
        const on = list.includes(id)
        if (on === perks.has(id)) continue
        if (on) perks.add(id)
        else perks.delete(id)
        stations.sold(id, on)
        if (id === 'opTruck') yard.soldOpTruck(on)
      }
    },
    // Replays a whole state, in the order it was bought: a loaded save, or a neighbour after a rebirth.
    load({ owned: list = [], levels = {}, rebirths: count = 0, signs = null }) {
      quiet = true
      try {
        plot.wipe()
        book.setUpgradeLevels(levels)
        trucks.repaint()
        trucks.refit()
        plot.setRebirths(count)
        for (const id of list) apply(id)
        setSigns(signs)
        showSales()
      } finally {
        quiet = false
      }
    },
    // What a neighbour needs to rebuild this yard.
    state: () => ({
      owned: [...owned],
      levels: book.upgradeLevels(),
      rebirths,
      perks: [...perks],
      signs: lines.flatMap((l) => l.stages.map((s) => (s.workers ? 1 : 0) + (s.next ? 2 : 0))),
    }),
    // A neighbour's new state: only what changed, unless their plot went (a rebirth).
    follow(next) {
      const list = next.owned ?? []
      const count = next.rebirths ?? 0
      const levels = next.levels ?? {}
      if (count !== rebirths || [...owned].some((id) => !list.includes(id))) {
        plot.load(next)
      } else {
        const before = book.upgradeLevel('truckLevel')
        book.setUpgradeLevels(levels)
        if (book.upgradeLevel('truckLevel') !== before) {
          trucks.repaint()
          trucks.refit()
        }
        quiet = true
        for (const id of list) apply(id)
        quiet = false
        setSigns(next.signs)
        showSales()
      }
      plot.setPerks(next.perks ?? [])
    },
  }
  yard.plot = plot
  showSales()
  hideExtraRings()
  return plot
}
