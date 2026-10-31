import { Group } from 'three'
import { GAME, YARD } from '../config.js'
import { solidBox } from '../propkit.js'
import { box, matte, place } from './kit.js'

// Wood Lifters: a yellow tower for each upper floor, by the log pile. Each log on the ground pile
// goes to whichever line has least to do, the top floor on a tie: its cage carries it up and tips
// it on the floor's pile, or the ground line takes it. Levels are bought on the deck.
//
// Step lifters do the same further down the line: a tower at the end of each machine's outgoing
// belt, reaching every floor. An item that would queue behind a busy machine rides to the floor
// whose next machine has least to do, and so does one whose line stops here.
const { lifter: S, stepLifter: T, line: L } = GAME
const CAGE_Y = 0.2 // m above a floor the cage rests

function buildTower(height) {
  const g = new Group()
  const yellow = matte('#f2c21c')
  const dark = matte(YARD.colors.navy)
  for (const x of [-S.half, S.half]) {
    for (const z of [-S.half, S.half]) box(g, yellow, 0.24, height, 0.24, x, height / 2, z)
  }
  for (let y = 3; y < height; y += 3) {
    for (const z of [-S.half, S.half]) box(g, dark, S.half * 2, 0.12, 0.12, 0, y, z)
    box(g, dark, 0.12, 0.12, S.half * 2, S.half, y, 0)
  }
  box(g, yellow, S.half * 2 + 0.3, 0.26, S.half * 2 + 0.3, 0, height + 0.13, 0)
  return g
}

function buildCage() {
  const g = new Group()
  const w = S.half * 1.7
  box(g, matte('#8f6638'), w, 0.14, w, 0, 0, 0)
  box(g, matte(YARD.colors.navy), w + 0.1, 0.1, w + 0.1, 0, -0.1, 0)
  for (const x of [-w / 2, w / 2]) box(g, matte('#f2c21c'), 0.08, 0.5, w, x, 0.3, 0)
  return g
}

// A step lifter's cage at the end of stage i's belt. One object, shared by that stage on every floor.
function createStep(scene, lines, items, i) {
  const { floors: F } = YARD
  const z = L.machines[i].z + L.machines[i].belt
  const towerHeight = F.y * (lines.length - 1) + 2.4
  const stopAt = (line) => line.base + L.beltY
  const tower = place(scene, buildTower(towerHeight), T.x, z)
  const cage = place(scene, buildCage(), T.x, z, 0, stopAt(lines[0]))
  tower.visible = cage.visible = false
  const pole = solidBox(S.half + 0.1, towerHeight / 2, S.half + 0.1, T.x, towerHeight / 2, z)
  pole.setEnabled(false)
  const load = []
  let level = 0
  let at = lines[0] // the floor the cage is at, or on its way to
  let to = null // where the load is going
  let called = null // a floor that wants it
  let incoming = 0
  let wait = 0
  let y = stopAt(lines[0])

  const size = () => T.levels[level - 1].load
  function fewest(line) {
    let best = null
    for (const l of lines) {
      if (l === line || !l.runs(i)) continue
      if (!best || l.queued(i + 1) < best.queued(i + 1)) best = l
    }
    return best
  }

  const out = {
    get level() {
      return level
    },
    // Off the end of a belt. True if the lifter takes the item, 'wait' to hold it there, false if
    // it carries on as usual.
    take(line, m, item) {
      if (!level) return false
      const rival = to ?? fewest(line)
      if (!rival || rival === line || !rival.runs(i)) return false
      const mine = line.runs(i) ? line.queued(i + 1) : Infinity
      if (mine - rival.queued(i + 1) < T.gap) return false
      const here = at === line && Math.abs(y - stopAt(line)) < 0.05
      if (!here || load.length + incoming >= size()) {
        if (!to) called = line
        return mine === Infinity ? 'wait' : false // a line that stops here holds it for the cage
      }
      to = rival
      incoming++
      wait = T.linger
      items.fly(item, { x: m.x, y: y + 0.5, z }, { x: T.x, y: y + 0.4, z }, 0.3, () => {
        incoming--
        load.push(item)
      })
      return true
    },
    set(n) {
      level = n
      tower.visible = cage.visible = true
      pole.setEnabled(true)
      for (const l of lines) l.stages[i].lift = out
    },
    reset() {
      level = 0
      at = lines[0]
      to = called = null
      load.length = 0
      incoming = 0
      y = stopAt(lines[0])
      cage.position.y = y
      tower.visible = cage.visible = false
      pole.setEnabled(false)
    },
    update(dt) {
      if (!level) return
      const { speed } = T.levels[level - 1]
      const goal = stopAt(at)
      if (y !== goal) {
        y = y < goal ? Math.min(y + speed * dt, goal) : Math.max(y - speed * dt, goal)
        cage.position.y = y
      } else if (at !== to && to && !incoming) {
        wait -= dt
        if (wait <= 0 || load.length >= size()) at = to
      } else if (at === to) {
        wait -= dt
        if (wait <= 0) {
          wait = S.tipEvery
          const item = load[load.length - 1]
          if (item && to.enter(i, item, { x: T.x, y: y + 0.5, z })) load.pop()
          if (!load.length) to = null
        }
      } else if (called) {
        at = called
        called = null
      }
      load.forEach((item, n) => items.stack(item, n, T.x, y + 0.1, z, 0, 0.5))
    },
  }
  return out
}

export function buildLifters(scene, lines, items) {
  const [groundLine] = lines
  const lifts = lines.slice(1).map((line) => {
    const top = line.base + CAGE_Y + 0.9
    const spot = S.spots[line.floor - 1]
    const tower = place(scene, buildTower(line.base + 2.4), spot.x, spot.z)
    const cage = place(scene, buildCage(), spot.x, spot.z, 0, CAGE_Y)
    tower.visible = cage.visible = false
    const pole = solidBox(S.half + 0.1, (line.base + 2.4) / 2, S.half + 0.1, spot.x, (line.base + 2.4) / 2, spot.z)
    pole.setEnabled(false)
    return { line, spot, top, tower, cage, pole, level: 0, state: 'wait', y: CAGE_Y, load: [], beat: 0, given: 0 }
  })

  // Logs are shared by count: a floor is due its next cage load once the ground line has taken as
  // many as it has. A floor that can't take any yet doesn't run up a debt.
  const size = (k) => S.levels[k.level - 1].load
  const taking = (k) => k.level > 0 && k.line.stages[0].owned && k.line.roomForLogs - k.load.length > 0
  const due = (k) => taking(k) && k.given <= groundLine.fed
  // So while a floor is due, the ground line leaves its cage load on the pile, cage away or not.
  groundLine.holdLogs = () => groundLine.pile.length <= lifts.reduce((n, k) => n + (due(k) ? size(k) : 0), 0)

  function step(k, dt) {
    const { load: logs } = k
    const { speed } = S.levels[k.level - 1]
    k.beat -= dt
    if (!taking(k)) k.given = Math.max(k.given, groundLine.fed)
    if (k.state === 'wait') {
      // With a surplus on the pile there's no turn to wait for.
      if (k.beat > 0 || !groundLine.pile.length || !taking(k)) return
      if (!due(k) && groundLine.pile.length <= size(k) * lifts.length) return
      const take = Math.min(size(k), k.line.roomForLogs, groundLine.pile.length)
      logs.push(...groundLine.pile.splice(0, take))
      k.given += take
      k.state = 'up'
    } else if (k.state === 'up') {
      k.y = Math.min(k.y + speed * dt, k.top)
      if (k.y >= k.top) k.state = 'tip'
    } else if (k.state === 'tip') {
      if (k.beat > 0) return
      k.beat = S.tipEvery
      const log = logs[logs.length - 1]
      if (log && k.line.feed(log, { x: k.spot.x, y: k.y + 0.5, z: k.spot.z })) logs.pop()
      if (!logs.length) k.state = 'down'
    } else {
      k.y = Math.max(k.y - speed * dt, CAGE_Y)
      if (k.y <= CAGE_Y) {
        k.state = 'wait'
        k.beat = S.rest
      }
    }
    k.cage.position.y = k.y
  }

  const steps = L.machines.slice(0, -1).map((m, i) => createStep(scene, lines, items, i))

  return {
    // A step lifter, by the stage whose belt it stands at. Level 1 builds it.
    setStep: (i, level) => steps[i].set(level),
    // Level 1 builds the lifter, the others speed it up.
    set(floor, level) {
      const k = lifts[floor - 1]
      k.level = level
      k.tower.visible = k.cage.visible = true
      k.pole.setEnabled(true)
    },
    reset() {
      for (const k of lifts) {
        k.level = 0
        k.given = 0
        k.state = 'wait'
        k.y = CAGE_Y
        k.cage.position.y = CAGE_Y
        k.load.length = 0
        k.tower.visible = k.cage.visible = false
        k.pole.setEnabled(false)
      }
      for (const s of steps) s.reset()
    },
    update(dt) {
      for (const s of steps) s.update(dt)
      for (const k of lifts) {
        if (!k.level) continue
        step(k, dt)
        k.load.forEach((log, i) => items.stack(log, i, k.spot.x, k.y + 0.1, k.spot.z, 0, 0.5))
      }
    },
  }
}
