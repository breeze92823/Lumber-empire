import { YARD } from '../config.js'

// What the Leaderboard shows, per panel stat: { rows: [{ name, value }], rank, you }. The server's
// lists land here (net.js `leaderboard`); each one replaces its entry, so the panels can tell a new
// list by its identity. With no server the list is empty and only the player's own row shows.
export const leaders = Object.fromEntries(YARD.leaderboard.panels.map((p) => [p.stat, { rows: [], rank: null, you: '' }]))

export function setLeaders({ boards, ranks }, you) {
  for (const stat of Object.keys(leaders)) {
    const rows = boards?.[stat]
    if (Array.isArray(rows)) leaders[stat] = { rows, rank: ranks?.[stat] ?? null, you }
  }
}
