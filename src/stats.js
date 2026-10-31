import { GAME, YARD } from './config.js'

// The upgrade boards' numbers: one level per GAME.upgrades entry, `stats` holds what each
// level is worth now, and every board row (YARD, by `id`) keeps its own text up to date here so
// the painters only ever read `row.sub`, `row.price` and `row.level`. A book is one yard's
// numbers: the player's own, exported below, writes those rows; a neighbour's writes nothing.
const { upgrades, trees } = GAME
const dollars = (n) => `$${n.toLocaleString('en-US')}`

// The leaderboard's numbers for the player. A rebirth keeps these.
export const career = { rebirths: 0, earned: 0, playtime: 0 }

// Two significant digits, so a growth factor still gives round prices.
function tidy(n) {
  const unit = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1)
  return Math.round(n / unit) * unit
}

const worth = (id, level) => upgrades[id].base + upgrades[id].step * level

export function createBook(rows = []) {
  const stats = {}
  const levels = {}
  const maxed = (id) => levels[id] >= upgrades[id].max

  // null once the upgrade is maxed.
  const upgradeCost = (id) => (maxed(id) ? null : tidy(upgrades[id].price * upgrades[id].growth ** levels[id]))

  function describe(row) {
    const { id } = row
    const { unit } = upgrades[id]
    const now = `${stats[id]}${unit}`
    row.level = levels[id]
    row.sub = maxed(id) ? now : `${now} > ${worth(id, levels[id] + 1)}${unit}`
    row.price = maxed(id) ? 'MAX' : dollars(upgradeCost(id))
  }

  // % chance of each tree type at the current Tree Luck; the commonest one takes what is left.
  function chances() {
    let rest = 100
    return trees.map((t) => {
      if (t.chance == null) return rest
      const c = (t.chance * stats.luck) / 100
      rest -= c
      return c
    })
  }

  function paintOdds() {
    if (!rows.length) return
    const odds = chances()
    YARD.eventBoard.low.odds = trees.map((t, i) => [`${t.name} (${t.logs} logs) ${+odds[i].toFixed(1)}%`, t.color])
  }

  function setUpgrade(id, level) {
    levels[id] = level
    stats[id] = worth(id, level)
    for (const row of rows) if (row.id === id) describe(row)
    if (id === 'luck') paintOdds()
  }

  const book = {
    stats,
    upgradeCost,
    setUpgrade,
    upgradeLevel: (id) => levels[id],
    // What a save or a neighbour's yard carries: { id: level }.
    upgradeLevels: () => ({ ...levels }),
    setUpgradeLevels(next) {
      for (const id of Object.keys(upgrades)) setUpgrade(id, next[id] ?? 0)
    },
    rollTree(rand = Math.random) {
      const odds = chances()
      let r = rand() * 100
      for (let i = 0; i < trees.length; i++) {
        r -= odds[i]
        if (r < 0) return trees[i]
      }
      return trees[trees.length - 1]
    },
    raiseUpgrade: (id) => setUpgrade(id, levels[id] + 1),
    // Back to level 0 on everything: a rebirth, and the start of the game.
    resetUpgrades() {
      for (const id of Object.keys(upgrades)) {
        levels[id] = 0
        stats[id] = worth(id, 0)
      }
      rows.forEach(describe)
      paintOdds()
    },
  }
  book.resetUpgrades()
  return book
}

export const book = createBook([YARD.workerBoard, YARD.playerBoard, YARD.eventBoard.top, YARD.eventBoard.low].flatMap((b) => b.rows))
export const { stats, upgradeCost, upgradeLevel, setUpgrade, raiseUpgrade, resetUpgrades } = book
