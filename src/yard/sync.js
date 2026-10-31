import { CREW_FIELDS } from './workers.js'
import { itemCode, itemFrom } from './items.js'

// The live yard: each owner tells the room what really stands in their yard, as nested arrays of
// numbers, and everyone else's copy (plots.js) takes it up. A copy runs the same machinery, so
// belts, machines and trucks keep moving between frames; a frame only sets it right.
// The server relays these unread (backend relay.ts), so a frame that makes no sense must never
// throw here: everything that reads one is wrapped.

// The crew and what has just fallen: [crew poses, [tree, fallX, fallZ, ...]].
export function captureFast(yard, felled) {
  return [yard.workers.snapshot(itemCode).slice(0, CREW_FIELDS * 80), yard.forest.felled(felled, [])]
}

// Everything slower: the forest, each floor, the Truck Conveyer, the trucks, the train.
export function captureSlow(yard) {
  return [
    yard.forest.snapshot(itemCode),
    yard.lines.map((l) => l.snapshot(itemCode)),
    yard.sky.snapshot(itemCode),
    yard.trucks.snapshot(),
    yard.train.snapshot(itemCode),
  ]
}

export function restoreFast(yard, frame) {
  try {
    const [crew, felled] = frame
    yard.workers.restore(crew)
    for (let i = 0; i + 2 < felled.length; i += 3) yard.forest.fellNow(felled[i], felled[i + 1], felled[i + 2])
  } catch (err) {
    console.warn('[sync] bad crew frame', err)
  }
}

export function restoreSlow(yard, frame) {
  try {
    const [forest, lines, sky, trucks, train] = frame
    yard.forest.restore(forest, itemFrom)
    lines.forEach((l, i) => yard.lines[i]?.restore(l, itemFrom))
    yard.sky.restore(sky, itemFrom)
    yard.trucks.restore(trucks)
    yard.train.restore(train, itemFrom)
  } catch (err) {
    console.warn('[sync] bad yard frame', err)
  }
}
