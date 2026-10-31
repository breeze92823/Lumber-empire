// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'lumber-empire' // slug registered on bloxity.io
export const GAME_TITLE = 'Lumber Empire'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'
// Local testing only: the wallet is full and never changes. Needs the Vite dev server as well as
// VITE_DEV_MODE, so a production build can never have it (import.meta.env.DEV is false there).
export const UNLIMITED_MONEY = DEV_MODE && import.meta.env.DEV
export const DEV_MONEY = 999_999_999

// Boxity's trophy button: the same boards as the Leaderboard in the yard (backend PLATFORM_BOARDS
// reports their scores). The first declaration creates a board and later edits here are ignored.
export const LEADERBOARDS = [
  { id: 'earned', label: 'Top Earners', order: 'desc', mode: 'best', format: 'compact', reset: 'none' }, // first: the portal opens on it
  { id: 'rebirths', label: 'Top Rebirths', order: 'desc', mode: 'best', format: 'number', reset: 'none' },
  { id: 'playtime', label: 'Top Playtime', order: 'desc', mode: 'best', format: 'time', reset: 'none' },
]

// The game server, for local development only: a built game always goes through the Bloxity
// matchmaker (bloxity.js resolveServerEndpoint).
export const SERVER_URL = import.meta.env.DEV ? import.meta.env.VITE_SERVER_URL_DEV || 'ws://localhost:2567' : ''
export const NET = {
  saveEvery: 5, // s: progress is sent at most this often (and when the tab hides or closes)
  retry: 2, // s before the first reconnect; doubles after each failed resolve/join...
  retryMax: 30, // ...up to this (the matchmaker can hold a cold start for ~45 s)
  rejoin: 1, // s before resolving again after the room closed (e.g. its pod is being replaced)
  // This player's pose goes out at most `poseHz` times a second (skipped while it stands still);
  // remote players ease toward their last pose (plus speed x heading for the time since it came:
  // dead reckoning) at `remoteLerp` 1/s, `predictMax` s of that at most.
  poseHz: 10,
  remoteLerp: 10,
  predictMax: 0.4,
  avatarFade: 60, // m: a remote player further off than this isn't drawn
  // The live yard (yard/sync.js): the crew every `fastEvery` s, belts, logs and trucks every
  // `slowEvery` s, and the yard's purchases, checked every `plotEvery` s.
  fastEvery: 0.2,
  slowEvery: 1,
  plotEvery: 0.5,
  friendsEvery: 30, // s between reads of the Bloxity friends list
  friendCountEvery: 2, // s between counts of the friends in the room
}

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
// A world holds six yards (yard/plots.js), two columns of three either side of the road. `seats` is
// which column (1 = east of the road, -1 = west, turned half way round about x = `axis`, the road's
// middle) and row each slot has. `band` = how far north and south a yard may spread round its own z.
export const PLOTS = {
  pitch: 110, // m between rows
  axis: -36,
  band: { north: -45, south: 65 },
  seats: [
    { side: 1, row: 0 },
    { side: -1, row: 0 },
    { side: 1, row: -1 },
    { side: -1, row: -1 },
    { side: 1, row: 1 },
    { side: -1, row: 1 },
  ],
  // A neighbour's yard is the real thing only next to it; from anywhere else a stand-in (yard/standIn.js).
  area: { west: -22, east: 71, north: -31, south: 51 }, // the fence's box at its widest, in a yard's own coordinates
  liveRange: 14, // m from that box: closer and the real yard comes in...
  liveLeave: 22, // ...until the viewer is this far out again
  bakeBudget: 25000, // vertices a frame a stand-in copies, so taking a new one is never a hitch
  bakeSoon: 1, // s from a purchase, or the viewer leaving, to a new stand-in
  atlas: { size: 2048, cell: 256, phone: 1024 }, // px: the stand-ins' shared pictures
  nameY: 17, // m: the owner's name over a yard
  nameHeight: 2.6,
}

export const GROUND_Y = 0
// The player's lumber yard, measured off the reference screenshots. Origin = where the
// reference character stands: north is the boards, east the forest, west the railroad,
// south the Leaderboard in the south fence.
export const YARD = {
  // Poured concrete floor of the yard.
  concrete: { west: -21.5, east: 20.5, north: -28.5, south: 50, color: '#d3cec5', size: 2048 },
  grass: { color: '#7fd07c', spot: '#6dc26c', tile: 22 },
  // Fence polyline, walked in order; `block` is the invisible wall above it. It starts and
  // ends at the two ends of the Leaderboard, which fills the gap in the south fence.
  fence: {
    points: [[-15.4, 50.5], [-22, 50.5], [-22, -30.5], [28, -30.5], [28, -25], [37, -25], [37, 50.5], [-0.6, 50.5]],
    spacing: 4.4,
    height: 1.55,
    rails: [0.62, 1.15],
    block: 3,
    post: '#6e4229',
    rail: '#a56f49',
    // Open double gates in the west fence, level with each truck bay: the opening is
    // `width` wide along z, the two leaves are swung back into the yard.
    gates: [
      { x: -22, z: -20.4, width: 6.4 },
      { x: -22, z: 0.8, width: 6.4 },
      { x: -22, z: 13, width: 6.4 },
      { x: -22, z: 23.4, width: 6.4 },
    ],
  },
  // West of the fence: grass, the railroad, grass, the road.
  rail: { x: -25.9, bedWidth: 3.5, gauge: 1.55, sleeperGap: 1.3, sleeper: '#5b3b2c', steel: '#8f949c', bed: '#a5a6a8', length: 1000 },
  road: {
    west: -42, east: -30, color: '#3c4358', dashColor: '#f2d33d', dashLength: 4.2, dashGap: 9, length: 1000,
    edgeColor: '#e9e6dc', edgeInset: 0.5,
    // The way out of each gate (fence.gates): a tarmac drive to the road, flared at its mouth, and
    // a timber deck over the rails that climbs from `from` to `top` and back from `end` to `to`.
    drive: { flare: 4.5, flareFrom: -28 },
    crossing: { from: -29.2, top: -27.8, end: -24, to: -22.6, height: 0.2, color: '#6a5a48', line: '#2b2a2e' },
  },
  colors: {
    wood: '#b37a48',
    woodDark: '#6e4229',
    woodLight: '#d9b184',
    navy: '#1f2a44',
    gold: '#e2a924',
    guardRail: '#e6ad26', // kept apart from `gold`: silhouettes draw it grey
    goldDark: '#b5801a',
    black: '#000000',
    silhouetteRim: '#8c8c8c',
  },

  // How every clickable board button reacts (boards.js). hover / pressed are scales, the spring is
  // underdamped so it overshoots a little; brighten / flash add to the face's light; outline is m.
  buttons: {
    hover: 1.07, pressed: 0.9, pressTime: 0.07, stiffness: 420, damping: 20,
    brighten: 0.22, flash: 0.5, flashTime: 0.3,
    outline: 0.06, outlineColor: '#fff3a8', denyColor: '#ff3b30', denyTime: 0.35, denyShake: 0.07, denyShakes: 6,
  },

  signRange: 13, // m from the player to a machine's floating signs they can click

  // Wooden boards along the north fence, all facing south.
  workerBoard: {
    x: -6.2, z: -28.2, w: 10, h: 4.5, lift: 1,
    title: 'WORKER UPGRADES',
    header: ['#39a7ee', '#7fd2ff', '#2f7fdf'],
    titleColor: '#dff2ff',
    titleOutline: '#1b5fae',
    rows: [
      { id: 'workerSpeed', name: 'Worker Speed' },
      { id: 'workerCarry', name: 'Worker Carry' },
      { id: 'workerAxe', name: 'Worker Axe' },
    ],
  },
  playerBoard: {
    x: 15, z: -28.2, w: 11.5, h: 5, lift: 1,
    title: 'PLAYER UPGRADES',
    header: ['#c98f1e', '#f4d067', '#c58a1d'],
    titleColor: '#dcecff',
    titleOutline: '#5d4a1a',
    rows: [
      { id: 'walkSpeed', name: 'Walk Speed' },
      { id: 'carry', name: 'Carry Capacity' },
      { id: 'axe', name: 'Axe Power' },
    ],
  },
  // The tall double board at the north-east corner of the concrete.
  eventBoard: {
    x: 25.5, z: -24.5, yaw: -0.5, w: 7.4, lift: 0.9, topH: 4.5, lowH: 3.9,
    top: {
      title: 'HALLOWEEN',
      progress: '',
      fill: 0,
      note: 'Haunted trees drop logs worth x2!',
      rows: [
        { id: 'treesNeeded', name: 'Trees Needed' },
        { id: 'hauntTime', name: 'Haunt Duration' },
      ],
    },
    low: {
      title: 'TREE LUCK',
      rows: [
        { id: 'luck', name: 'Tree Luck' },
        { id: 'regrow', name: 'Tree Regrowth' },
      ],
      odds: [], // painted from GAME.trees and the Tree Luck level
    },
    pumpkin: '#f09a1c',
  },
  // Small paid-perk sign by the north-east fence.
  perkSign: {
    x: 30.8, z: -22.6, yaw: -0.25, w: 4.3, h: 3.5, lift: 0.7,
    panels: [
      { title: 'Infinite Cash', sub: 'Forever', colors: ['#2f6cf2', '#8a4cf0', '#d85bf0'] },
      { title: 'Rainbow Saw', sub: 'Forever', colors: ['#ff4d6d', '#ffb13d', '#ffe14a', '#49e07a', '#3ab7ff', '#b45cff'] },
    ],
  },
  // The upper floors: decks over the line, y metres apart, an L round its corner. `plans` holds
  // each deck's rectangles, its rails as [x, z, x, z] and the stair up to it (`top` = its z at
  // the deck, `dir` = which way z runs going down). `route` = where workers walk to go up a floor.
  floors: {
    y: 8.4, step: 0.38, run: 0.6, tread: 0.7, railHeight: 1.1, railEvery: 3,
    priceMult: [5, 25], // what a floor's machines cost, times the ground floor's
    workers: 2, // max workers each floor adds
    posts: [[2, -21], [2, -6], [2, 9], [2, 20], [2, 41.6], [16.5, -21], [16.5, -6], [16.5, 9], [16.5, 24], [16.5, 41.6], [-4.4, 26], [-11, 26], [-11, 36.6], [-8.9, 41.6]],
    plans: [
      {
        decks: [{ west: 2, east: 16.5, north: -21, south: 41.6 }, { west: -4.4, east: 2, north: 20, south: 41.6 }, { west: -8.9, east: -4.4, north: 26, south: 41.6 }, { west: -11, east: -8.9, north: 26, south: 36.6 }],
        rails: [[2, -21, 16.5, -21], [16.5, -21, 16.5, 41.6], [-8.9, 41.6, 16.5, 41.6], [2, -21, 2, 20], [-4.4, 20, -4.4, 26], [-11, 26, -4.4, 26], [-11, 26, -11, 36.6], [-11, 36.6, -8.9, 36.6], [-8.9, 36.6, -8.9, 41.6]],
        stair: { west: -1.2, east: 1.8, top: 20, dir: -1 },
        board: { x: 5, z: -20.7, w: 5.6, h: 1.3, lift: 1.1, text: 'GOLD WOOD SELLS FOR 3X!' },
      },
      {
        decks: [{ west: 2, east: 16.5, north: -21, south: 41.6 }, { west: -8.9, east: 2, north: 26, south: 41.6 }, { west: -11, east: -8.9, north: 26, south: 36.6 }, { west: -4.4, east: 2, north: 3.8, south: 6.2 }],
        rails: [[2, -21, 16.5, -21], [16.5, -21, 16.5, 41.6], [-8.9, 41.6, 16.5, 41.6], [2, -21, 2, 3.8], [2, 6.2, 2, 26], [-11, 26, 2, 26], [-11, 26, -11, 36.6], [-11, 36.6, -8.9, 36.6], [-8.9, 36.6, -8.9, 41.6], [-4.4, 3.8, 2, 3.8], [-4.4, 3.8, -4.4, 6.2], [-1.3, 6.2, 2, 6.2]],
        stair: { west: -4.4, east: -1.4, top: 6.2, dir: 1 },
      },
    ],
    route: [[[0.3, 5.2], [0.3, 21], [3, 21]], [[-2.9, 21], [-2.9, 5], [3, 5]]],
  },

  // The tall paid-perk tower on the west fence, three panels stacked, facing the yard.
  perkTower: {
    x: -20.3, z: -12, yaw: Math.PI / 2 + 0.12, w: 2.9, h: 6.4,
    panels: [
      { title: 'x2 Luck', sub: 'Forever', colors: ['#2fb84f', '#5fd85f'] },
      { title: 'Golden Trucks', sub: 'Forever', colors: ['#f0b528', '#ffd84a'] },
      { title: 'Rainbow Trucks', sub: 'Forever', colors: ['#ff4d6d', '#ffb13d', '#ffe14a', '#49e07a', '#3ab7ff', '#b45cff'] },
    ],
  },
  // A three-panel board in a gap of the south fence, facing the yard (north). Each panel lists the top `rows` of a `career` stat (stats.js)
  // over the player's own row, and the player joins the list on beating a row in it.
  leaderboard: {
    x: -8, z: 50, yaw: Math.PI, panelW: 4, h: 6.2, gap: 0.5, lift: 0.9,
    rows: 10,
    refresh: 2, // s between checks of the player's numbers
    you: 'You',
    unranked: '100+', // the player's rank while off the list
    panels: [
      { title: 'TOP REBIRTHS', stat: 'rebirths', format: 'count', youColor: '#ffd23f' },
      { title: 'TOP EARNERS', stat: 'earned', format: 'money', youColor: '#7ee26d' },
      { title: 'TOP PLAYTIME', stat: 'playtime', format: 'time', youColor: '#ffd23f' }, // s
    ],
    medals: ['#ffd23f', '#d5dbe6', '#f0913a'], // ranks 1 to 3; the rest are white
    skins: ['#f6cfa8', '#e8b488', '#c98d5e', '#8d5a3a', '#ffd9a0'],
    hair: ['#2b2230', '#5a3a22', '#c98f2e', '#b0342c', '#3a5fd0', '#e6e3dc'],
  },

  // Workers stall + its hire ring, and the locked Hacker stand next to it.
  stall: { x: 0.9, z: -26.4, title: 'WORKERS' },
  hacker: { x: 6.2, z: -27, ringRadius: 2.7, title: 'HACKER', sub: '2x MONEY FOREVER' },
  kiosk: { x: -15.6, z: -29.1, title: 'TRUCKS' },

  // Machine slots down the east side of the concrete, pads about 16 m apart. Every machine
  // stays black until bought, the Debarker ($10) first. `wide` pads lie east-west.
  pads: [
    { x: 12.4, z: -12.5 },
    { x: 12.4, z: 2.8 },
    { x: 12.4, z: 18.6 },
    { x: 12.4, z: 34.6, l: 8.5 },
    { x: -4, z: 38.2, wide: true },
  ],
  pad: { w: 5.6, l: 11.2, color: '#b7c3da', edge: '#5f7fb6' },
  machines: { debarker: { x: 12.4, z: -12.5 }, sawmill: { x: 12.4, z: 2.8 }, kiln: { x: 12.4, z: 18.6 }, bundler: { x: 12.4, z: 34.6 }, workshop: { x: -4, z: 38.2 } },
  // For-sale signs, each with a BUY ring (`rings`, matched by `buy`). Those at the machines
  // face west, the Truck Bays face the yard. `needs` = what must be owned first (a machine only
  // needs the machine before it: without a conveyor the workers carry the goods); a sign with
  // `later` only stands once its `needs` is owned, one with `rebirth` from that many rebirths on.
  saleSigns: [
    { id: 'debarker', x: 7.4, z: -12.5, title: 'Debarker', price: '$10', yaw: -Math.PI / 2 },
    { id: 'sawmill', x: 7.4, z: 2.8, title: 'Sawmill', price: '$150', yaw: -Math.PI / 2 },
    { id: 'kiln', x: 7.4, z: 18.4, title: 'Kiln', price: '$1,500', yaw: -Math.PI / 2, needs: 'sawmill' },
    { id: 'bundler', x: 7.4, z: 34.3, title: 'Bundler', price: '$5,000', yaw: -Math.PI / 2, needs: 'kiln' },
    { id: 'conveyor1', x: 7.4, z: -5.1, title: 'Conveyor', price: '$100', yaw: -Math.PI / 2, needs: 'sawmill', later: true },
    { id: 'conveyor2', x: 7.4, z: 10.6, title: 'Conveyor', price: '$750', yaw: -Math.PI / 2, needs: 'kiln', later: true },
    { id: 'conveyor3', x: 7.4, z: 27.7, title: 'Conveyor', price: '$2,500', yaw: -Math.PI / 2, needs: 'bundler', later: true },
    { id: 'debarkerTurbo', x: 7.4, z: -12.5, title: 'Debarker Turbo', price: '$30,000', yaw: -Math.PI / 2, needs: 'conveyor2', later: true },
    // Bay Conveyers (GAME.line.feeds). `also` = owned as well, but they don't hide the sign. Two
    // bays keep up with the line, so none is any use before a third truck stands idle. Priced to
    // pay back in about 15 minutes at the rebirth that opens them.
    { id: 'feed0', x: 7.4, z: -5.1, title: 'Bay 2 Conveyer', price: '$10,000', yaw: -Math.PI / 2, needs: 'conveyor1', also: ['truckConveyor', 'truckBay3'], later: true, rebirth: 2 },
    { id: 'feed1', x: 7.4, z: 10.6, title: 'Bay 3 Conveyer', price: '$15,000', yaw: -Math.PI / 2, needs: 'conveyor2', also: ['truckConveyor', 'truckBay3'], later: true, rebirth: 3 },
    { id: 'feed2', x: 7.4, z: 27.7, title: 'Bay 4 Conveyer', price: '$400,000', yaw: -Math.PI / 2, needs: 'conveyor3', also: ['truckConveyor', 'truckBay4'], later: true, rebirth: 5 },
    { id: 'conveyor4', x: 7.4, z: 34.3, title: 'Conveyor', price: '$40,000', yaw: -Math.PI / 2, needs: 'workshop', later: true, rebirth: 1 },
    { id: 'workshop', x: -0.8, z: 31.4, title: 'Workshop', price: '$50,000', yaw: Math.PI, needs: 'bundler', rebirth: 1 },
    { id: 'tables', x: -0.8, z: 31.4, title: 'Tables', price: '$250,000', yaw: Math.PI, needs: 'workshop', later: true, rebirth: 1 },
    { id: 'beds', x: -0.8, z: 31.4, title: 'Beds', price: '$1,200,000', yaw: Math.PI, needs: 'tables', later: true, rebirth: 1 },
    { id: 'truckConveyor', x: -6.4, z: 31.4, title: 'Truck Conveyer', price: '$25,000', yaw: Math.PI, needs: 'workshop', rebirth: 1 },
    { id: 'conveyerSpeed', x: -6.4, z: 31.4, title: 'x2 Conveyer Speed', price: '$1,500,000', yaw: Math.PI, needs: 'truckConveyor', later: true, rebirth: 1 },
    { id: 'secondFloor', x: -13, z: 31.4, title: 'Second Floor', price: '$500,000', yaw: Math.PI, rebirth: 1 },
    { id: 'truckBay2', x: -18.8, z: 0.8, title: 'Truck Bay 2', price: '$300', yaw: Math.PI / 2 },
    { id: 'truckBay3', x: -18.8, z: 13, title: 'Truck Bay 3', price: '$3,000', yaw: Math.PI / 2, needs: 'truckBay2', later: true, rebirth: 2 },
    { id: 'truckBay4', x: -18.8, z: 23.4, title: 'Truck Bay 4', price: '$18,000', yaw: Math.PI / 2, needs: 'truckBay3', later: true, rebirth: 5 },
    { id: 'trainLoader', x: -17.5, z: 31.4, title: 'Train Loader', price: '$5,000,000', yaw: Math.PI, needs: 'truckConveyor', rebirth: 2 },
    { id: 'moreForest', x: 36.2, z: 11, title: 'More Forest', price: '$120', yaw: -Math.PI / 2, small: true },
  ],

  // Trucks. `yaw` turns the model's nose (+Z) to its heading.
  ownedTruck: { x: -14.4, z: -20.4, yaw: -Math.PI / 2, color: '#eab51c', trim: '#c99212', glass: '#2a55e0' },
  opTruck: {
    x: -16.4, z: -10.2, yaw: 0.62, scale: 0.74, // nosed in diagonally, pointing south-east at its Buy ring
    title: 'OP TRUCK',
    sub: '30 LOGS • +200% FULL • 2x FAST',
    neon: '#25e3ff',
  },
  // The Truck Level's trucks (GAME.trucks.levels[].rig, models in yard/rigModels.js).
  rigs: {
    starter: { paint: '#eab51c', trim: '#c99212', rim: '#d9dbe0' },
    bigRig: { paint: '#c92f26', trim: '#f0e9dc', rim: '#e8eaee' },
    logLoader: { paint: '#2e7f4e', trim: '#e0a722', rim: '#e0a722', crane: '#f2c21c' },
    titan: { paint: '#1d46c2', trim: '#f2bf2e', rim: '#f4f5f7' },
    op: { paint: '#6a36e8', trim: '#2b52e8', rim: '#c3c9d6', neon: '#25e3ff', stake: '#b9a7ff' },
  },
  // Padlocked silhouettes, each with the rebirth it needs. One with `sale` is a truck parked in
  // that Truck Bay until the bay's sign stands.
  locked: [
    { x: -14.4, z: 13, yaw: -Math.PI / 2, scale: 1, sale: 'truckBay3', label: 'Rebirth 2', lockY: 7, labelY: 5, lock: 2.9, text: 1 },
    { x: -14.4, z: 23.4, yaw: -Math.PI / 2, scale: 1, sale: 'truckBay4', label: 'Rebirth 5', lockY: 7, labelY: 5, lock: 2.9, text: 1 },
    { x: -19, z: 27.4, label: 'Rebirth 2', lockY: 8.2, labelY: 6.2, lock: 2.9, text: 1 }, // the Train Loader, up on its stilts
    { x: -4, z: 38.2, label: 'Rebirth 1', lockY: 5.4, labelY: 4.2, lock: 1.5, text: 0.55, shade: true },
  ],

  // Floor rings: colour, text, radius, and the way the text reads.
  rings: [
    { x: 4.1, z: 2.8, r: 1.5, color: '#3ee07a', text: 'BUY', yaw: Math.PI / 2, buy: 'sawmill' },
    { x: 4.1, z: 17.8, r: 1.3, color: '#3ee07a', text: 'BUY', yaw: Math.PI / 2, buy: 'kiln' },
    { x: 4.1, z: 34, r: 1.3, color: '#3ee07a', text: 'BUY', yaw: Math.PI / 2, buy: 'bundler' },
    { x: 4.1, z: -5.1, r: 1.3, color: '#3ee07a', text: 'BUY', yaw: Math.PI / 2, buy: 'conveyor1' },
    { x: 4.1, z: 10.6, r: 1.3, color: '#3ee07a', text: 'BUY', yaw: Math.PI / 2, buy: 'conveyor2' },
    { x: 4.1, z: 27.7, r: 1.3, color: '#3ee07a', text: 'BUY', yaw: Math.PI / 2, buy: 'conveyor3' },
    { x: 4.1, z: 34, r: 1.3, color: '#3ee07a', text: 'BUY', yaw: Math.PI / 2, buy: 'conveyor4' },
    { x: 4.1, z: -5.1, r: 1.3, color: '#25c7f2', text: 'BUY', yaw: Math.PI / 2, buy: 'feed0' },
    { x: 4.1, z: 10.6, r: 1.3, color: '#25c7f2', text: 'BUY', yaw: Math.PI / 2, buy: 'feed1' },
    { x: 4.1, z: 27.7, r: 1.3, color: '#25c7f2', text: 'BUY', yaw: Math.PI / 2, buy: 'feed2' },
    { x: 4.1, z: -12.5, r: 1.5, color: '#3ee07a', text: 'BUY', yaw: Math.PI / 2, buy: 'debarker' },
    { x: 4.1, z: -12.5, r: 1.5, color: '#f2d531', text: 'EXPAND', yaw: Math.PI / 2, buy: 'debarkerTurbo' },
    { x: -0.8, z: 28.2, r: 1.5, color: '#3ee07a', text: 'BUY', yaw: Math.PI, buy: 'workshop' },
    { x: -0.8, z: 28.2, r: 1.5, color: '#3ee07a', text: 'BUY', yaw: Math.PI, buy: 'tables' },
    { x: -0.8, z: 28.2, r: 1.5, color: '#3ee07a', text: 'BUY', yaw: Math.PI, buy: 'beds' },
    { x: -6.4, z: 28.2, r: 1.5, color: '#25c7f2', text: 'BUY', yaw: Math.PI, buy: 'truckConveyor' },
    { x: -6.4, z: 28.2, r: 1.5, color: '#25c7f2', text: 'BUY', yaw: Math.PI, buy: 'conveyerSpeed' },
    { x: -13, z: 28.2, r: 1.5, color: '#f2d531', text: 'EXPAND', yaw: Math.PI, buy: 'secondFloor' },
    { x: -17.5, z: 28.2, r: 1.5, color: '#25c7f2', text: 'BUY', yaw: Math.PI, buy: 'trainLoader' },
    { x: -12.5, z: 12.4, r: 1.8, color: '#f2d531', text: 'EXPAND', yaw: Math.PI / 2, buy: 'truckBay3' },
    { x: -12.5, z: 22.8, r: 1.8, color: '#f2d531', text: 'EXPAND', yaw: Math.PI / 2, buy: 'truckBay4' },
    { x: -6.2, z: 13, r: 1.65, color: '#f2d531', text: 'SELL', yaw: Math.PI / 2 - 0.3, sell: 2 },
    { x: -6.2, z: 23.4, r: 1.65, color: '#f2d531', text: 'SELL', yaw: Math.PI / 2 - 0.3, sell: 3 },
    { x: -13.2, z: -5.7, r: 1.9, color: '#16d690', text: 'BUY', yaw: -0.3, perk: 'opTruck' },
    { x: -7, z: -17.9, r: 1.65, color: '#f2d531', text: 'SELL', yaw: Math.PI / 2 - 0.3, sell: 0 },
    { x: -6.2, z: 0.8, r: 1.65, color: '#f2d531', text: 'SELL', yaw: Math.PI / 2 - 0.3, sell: 1 },
    { x: 0.5, z: -23.8, r: 1.6, color: '#25c7f2', text: 'HIRE', yaw: 0.05 },
    { x: 6.2, z: -23.9, r: 1.25, color: '#25d690', text: 'BUY', yaw: 0.05, perk: 'hacker' },
    { x: -14.5, z: -26.3, r: 1.6, color: '#25c7f2', text: 'UPGRADE', yaw: 0.05 },
    { x: -12.5, z: 0.2, r: 1.8, color: '#f2d531', text: 'EXPAND', yaw: Math.PI / 2, buy: 'truckBay2' },
    { x: -20, z: 7.6, r: 1.7, color: '#f2d531', text: 'TRAIN', yaw: Math.PI / 2 },
    { x: 33.5, z: 11, r: 1.1, color: '#f2d531', text: 'BUY', yaw: Math.PI / 2, buy: 'moreForest' },
    { x: 10.4, z: -19.6, r: 1.5, color: '#f2c531', text: 'LOGS IN', yaw: 0.2, dark: true, logsIn: true },
  ],
  alerts: [{ x: -15.6, y: 7.2, z: -29.1 }, { x: 0.9, y: 8, z: -26.4 }],

  // East of the concrete: pines inside the fence, a few more past it, some cut stumps.
  forest: {
    seed: 77,
    rows: { west: 24.5, east: 34.5, north: -21, south: 40, gapX: 4.9, gapZ: 8.6, jitter: 1.4 },
    // Trees past the fence, rectangle by rectangle.
    outer: [
      { west: 8, east: 95, north: -82, south: -34, count: 40 },
      { west: 41, east: 66, north: -24, south: 60, count: 30 },
    ],
    fixed: [[26.2, -14.5], [28.8, -2.8], [30, -20.5]],
    big: [[29.5, 24.5], [33, 32.5]], // start out as Big Trees

    golden: [[31.5, -29.5]],
    stumps: [[23.4, -9.5], [23.6, -7], [25, 15]],
    clear: 3.2, // m of space kept round each planted tree and the More Forest ring
    // The land past the east fence, bought a strip at a time up to the airport's fence (AIR.compound).
    // Each strip moves the fence out to `east`, opens its trees and leaves room for `logs` more on
    // the ground. `land` = the rows they stand in: `columns` of them to a strip, staggered. Prices are guesses.
    land: { columns: 2, north: -22.5, south: 48, gapZ: 6, jitter: 1.2 },
    parcels: [
      { sale: 'moreForest2', title: 'More Forest II', price: '$2,500', east: 48, logs: 20, note: 'The fence moved out: a new strip of forest is yours to chop' },
      { sale: 'moreForest3', title: 'More Forest III', price: '$20,000', east: 59, logs: 20, note: 'The fence moved out again: more forest to chop' },
      { sale: 'moreForest4', title: 'More Forest IV', price: '$150,000', east: 70.5, logs: 20, note: 'Your forest now runs all the way to the airport' },
    ],
    foliage: ['#14593a', '#5fd085'],
    goldFoliage: ['#b6892a', '#e0bf56'],
    trunk: '#40292a',
    stump: '#3d2b28',
    stumpTop: '#d8ae78',
  },

  // Blocky NPCs that walk the yard. The tag is the player's best employee (WINDOWS.index).
  workers: {
    tag: 'Hard Hat',
    skin: '#e6c99a', shirt: '#e8892b', arm: '#e6c99a', pants: '#1f3a8c', shoes: '#14224f', hat: '#f5c92e',
    axe: { handle: '#b0432e', head: '#3b4c6e' },
    spawn: [0.5, -22.6], // where a hire walks in, and where the crew waits while switched off
  },

  train: {
    interval: 352, // s between trains; the first one comes after this (5:52 on the HUD)
    dock: 75, // s it stands at the Train Loader's chute
    perWagon: 6, // items, two layers of three
    pay: 2, // what a load pays, times the same load on a plain truck
    speed: 34, // m/s
    clearAhead: 300, // m ahead of it at which a truck won't start over the crossing (it covers that in about the time a truck takes to cross)
    brake: 14, // m/s2 it slows at for a truck on the line
    span: 340, // m north and south of the yard it runs before despawning
    wagons: 7,
    body: '#1f2433', boiler: '#2a3144', cab: '#c23d33', trim: '#e6b53a', wagon: '#7a5a3e',
  },

  // Point lights that wake up at night (day/night toggle N).
  lamps: [
    { x: 12.4, y: 6.2, z: -13.5 },
    { x: 0.9, y: 5.2, z: -24.6 },
    { x: -15.6, y: 4, z: -27.4 },
    { x: -13.2, y: 3.6, z: -5.7 },
    { x: 15, y: 6, z: -25 },
  ],

  // Particles (particles.js): `count` is per emitter at full density.
  fx: {
    sawdust: { count: 80, life: 1.5, size: 0.17, color: '#e0b98a' },
    smoke: { count: 30, life: 3, size: 1.1, color: '#d8d8dc' },
    turbo: { dust: 150, chips: 60, sparks: 70, glow: 36, smoke: 36 }, // the Debarker Turbo, while it runs
    chips: { count: 26, life: 0.9, size: 0.22, color: '#7a4f33' },
    ring: { count: 16, life: 2, size: 0.22 },
    op: { count: 50, life: 2.2, size: 0.3 },
    hacker: { count: 40, life: 2.4, size: 0.2, color: '#3dff8a' },
    leaves: { count: 240, life: 9, size: 0.26, colors: ['#2f9a58', '#57b86a', '#d8b64a'] },
    motes: { count: 90, life: 8, size: 0.12, color: '#fff5d8' },
  },
}

// Each strip of forest is sold where the last one ended: just inside the fence, as More Forest is.
YARD.forest.parcels.forEach((p, i, parcels) => {
  const sale = YARD.saleSigns.find((s) => s.id === 'moreForest')
  const ring = YARD.rings.find((r) => r.buy === 'moreForest')
  const shift = (i ? parcels[i - 1].east : YARD.fence.points[5][0]) - YARD.fence.points[5][0]
  YARD.saleSigns.push({ ...sale, id: p.sale, x: sale.x + shift, title: p.title, price: p.price, needs: i ? parcels[i - 1].sale : sale.id, later: true })
  YARD.rings.push({ ...ring, x: ring.x + shift, buy: p.sale })
})

// Every upper floor repeats the ground floor's machines, id@floor, at its own prices, then adds
// what only a floor has: a LOGS IN ring, its Wood Lifter and the Truck Lifter down to the belt.
const money = (n) => `$${n.toLocaleString('en-US')}`
const sellAt = (sale, k) => money(Number(sale.price.replace(/[^0-9]/g, '')) * k)
const FLOOR_SALES = ['debarker', 'sawmill', 'kiln', 'bundler', 'conveyor1', 'conveyor2', 'conveyor3', 'conveyor4', 'debarkerTurbo', 'workshop', 'tables', 'beds']
const FLOOR_LIFTERS = [
  { id: 'lifter', title: 'Wood Lifter', price: 100000 },
  { id: 'lifterFast', title: 'Lifter Speed', price: 400000, needs: 'lifter' },
  { id: 'lifterMax', title: 'Lifter Max', price: 1500000, needs: 'lifterFast' },
]
const groundSales = [...YARD.saleSigns]
const groundRings = [...YARD.rings]
YARD.saleSigns.push({ id: 'thirdFloor', x: 7.4, z: 23, y: YARD.floors.y, floor: 1, title: 'Third Floor', price: '$25,000,000', yaw: -Math.PI / 2, rebirth: 1 })
YARD.rings.push({ x: 4.1, z: 23, y: YARD.floors.y, floor: 1, r: 1.5, color: '#f2d531', text: 'EXPAND', yaw: Math.PI / 2, buy: 'thirdFloor' })
// A step lifter's sign takes over from the conveyor's on the Second Floor once that's bought.
;['Sawmill', 'Kiln', 'Bundler', 'Workshop'].forEach((name, i) => {
  const belt = `conveyor${i + 1}`
  const sale = groundSales.find((s) => s.id === belt)
  const ring = groundRings.find((r) => r.buy === belt)
  const onDeck = { ...sale, y: YARD.floors.y, floor: 1, rebirth: 1, later: true }
  const price = [40000, 120000, 300000, 800000][i]
  const levels = [
    { id: `step${i}`, title: `${name} Lifter`, price, needs: `${belt}@1` },
    { id: `stepFast${i}`, title: `${name} Lifter +`, price: price * 3, needs: `step${i}` },
  ]
  for (const l of levels) {
    YARD.saleSigns.push({ ...onDeck, ...l, price: money(l.price) })
    YARD.rings.push({ ...ring, y: YARD.floors.y, floor: 1, text: 'UPGRADE', color: '#f2d531', buy: l.id })
  }
})
YARD.floors.priceMult.forEach((k, i) => {
  const floor = i + 1
  const y = YARD.floors.y * floor
  const tag = (id) => `${id}@${floor}`
  const onFloor = { y, floor, rebirth: 1 }
  for (const id of FLOOR_SALES) {
    const sale = groundSales.find((s) => s.id === id)
    YARD.saleSigns.push({ ...sale, ...onFloor, id: tag(id), price: sellAt(sale, k), needs: sale.needs && tag(sale.needs) })
    YARD.rings.push({ ...groundRings.find((r) => r.buy === id), y, floor, buy: tag(id) })
  }
  const truck = groundSales.find((s) => s.id === 'truckConveyor')
  YARD.saleSigns.push({ ...truck, ...onFloor, id: tag('truckConveyor'), title: 'Truck Lifter', price: money(60000 * k), needs: tag('workshop'), also: 'truckConveyor' })
  YARD.rings.push({ ...groundRings.find((r) => r.buy === 'truckConveyor'), y, floor, buy: tag('truckConveyor') })
  for (const l of FLOOR_LIFTERS) {
    YARD.saleSigns.push({ ...onFloor, id: tag(l.id), x: 7.4, z: -18.4, title: l.title, price: money(l.price * k), yaw: -Math.PI / 2, needs: l.needs && tag(l.needs), later: !!l.needs })
    YARD.rings.push({ x: 4.1, z: -18.4, y, floor, r: 1.5, color: '#f2d531', text: l.needs ? 'UPGRADE' : 'BUY', yaw: Math.PI / 2, buy: tag(l.id) })
  }
  YARD.rings.push({ ...groundRings.find((r) => r.logsIn), y, floor })
})

// The way east and the airport. All of it stands in the player's own yard only, like the Leaderboard
// (a neighbour's yard keeps the closed hatch and nothing else), so none of it goes through yard/sync.js.
// A trench runs east from the forest down to a tunnel under the fence and the far trees, and a second
// one climbs out on the apron. The floor colliders have holes there (world.js), the lawn too. The
// airport is laid out round its biggest plane: AIR.planes.titan, 44 m across the wings.
const STAGE_LINKS = [
  { id: 'link0', stage: 0, name: 'Debarker', sale: 'debarker', price: 20000 },
  { id: 'link1', stage: 1, name: 'Sawmill', sale: 'sawmill', price: 30000 },
  { id: 'link2', stage: 2, name: 'Kiln', sale: 'kiln', price: 50000 },
  { id: 'link3', stage: 3, name: 'Bundler', sale: 'bundler', price: 90000 },
  { id: 'link4', stage: 4, name: 'Workshop', sale: 'workshop', price: 150000 },
]
export const AIR = {
  rebirth: 3, // rebirths before the tunnel can be dug
  tunnel: {
    z: 4.5, half: 4, // its middle and half its width
    west: 25, portal: 36.5, // the trench: lawn level at `west`, tunnel level at `portal`
    east: 75, top: 86.5, // the tunnel's far end, and where the far trench comes up
    floor: -6, roof: -2, // the roof is the underside of the floor collider
    keepClear: 2.4, // m of forest kept off the trench
    skirt: 1.4, // m the crew stays off it, walking round
    lampEvery: 6.5, // m between timber sets, each with a lamp
    lane: 5.9, // z workers walk it on; they spread by a little each
  },
  // The perimeter fence goes all the way round the runway: the biggest plane's wing tips pass inside
  // it on the runway and at the west end of its turn, and it is airborne before the east fence.
  // `north` and `south` stay inside PLOTS.band, so nothing of the next yard stands in here.
  compound: { west: 72, east: 566, north: -45, south: 64.5, postEvery: 6, height: 3.4, block: 3.4, tile: 120 },
  apron: { west: 86.5, east: 236, north: -44, south: 31, color: '#b9bcc0', line: '#f2c21c' },
  runway: { z: 41, half: 10, west: 96, east: 542, color: '#3a3f4b', edgeEvery: 24, dashEvery: 22 },
  stand: { z: 5, lip: 122 }, // planes stop with the end of their lowered ramp at x = lip
  // The taxi route, corners and radius: stand > east along the apron > S-bend > runway heading east.
  taxi: { turn: 18, east: 178, hold: 214, back: 118 },
  // Fixed spots on the apron.
  hangar: { x: 152, z: -32.5, w: 64, d: 24, h: 20 },
  tanks: { x: 206, z: -32 },
  sock: { x: 240, z: 27 },
  masts: [[90, -42], [232, -42], [90, 27], [232, 27], [330, 56], [450, 56], [330, 27], [450, 27]],
  // The steel bunker logs and goods wait in, and how many of what's in it show over its walls.
  pile: { x: 108, z: 0.4, stand: [103.4, 3.9], max: 240, show: 24, wall: 2.4, w: 6, d: 6 },
  // The telescopic boom from the bunker to a plane's ramp. It draws back while a plane turns in.
  loader: { foot: [111.6, 0.9, 1.6], head: [121.2, 1.9, 5], back: 5.4, speed: 13, gap: 1.9, width: 1.2, slide: 2.2 },
  // The Tunnel Conveyor, [x, y, z] of the belt surface: down the north side of the trench, along the
  // tunnel and up the far trench to the head of the bunker. `gap` keeps logs apart.
  belt: {
    path: [[23.2, 0.95, 1.4], [25, 0.95, 1.4], [36.5, -5.05, 1.4], [75, -5.05, 1.4], [86.5, 0.95, 1.4], [104.4, 0.95, 1.4]],
    width: 1.5, speed: 3.4, boost: 3, gap: 3.3, cleatEvery: 1.2,
  },
  // The Cargo Trunk: bought with the Tunnel Conveyor, on stilts up the east side of the line from the
  // Workshop's corner to a chute over the hopper. Each stage's Air Link joins it `spur` along.
  trunk: {
    path: [[-9.1, 5, 44], [19.9, 5, 44], [19.9, 5, 1.4], [22.3, 3.5, 1.4]],
    legEvery: 8, width: 1.3,
    spur: 3.75, // m of z a link slants past the end of its machine's belt, clear of the lifter towers
    shaftTop: 2.6, // m a link's drop shaft stands above the highest floor
    from: 5.7, // where a link's run ends over the trunk
    backlog: 3, // items the next machine must have to get through before a link takes one: only what it can't keep up with leaves the line
    kick: 0.35, // s the diverter arm is across the belt
  },
  links: STAGE_LINKS,
  sales: [
    { id: 'tunnel', own: true, x: 27.8, z: 4.5, title: 'Dig Tunnel', price: '$75,000', yaw: -Math.PI / 2, needs: 'sawmill', rebirth: 3 },
    { id: 'airstrip', own: true, x: 93, z: 4.5, title: 'Airport', price: '$150,000', yaw: -Math.PI / 2, needs: 'tunnel', later: true, rebirth: 3 },
    { id: 'airBelt', own: true, x: 25, z: -3.4, title: 'Tunnel Conveyor', price: '$60,000', yaw: -Math.PI / 2, needs: 'airstrip', later: true, rebirth: 3 },
    { id: 'airBeltFast', own: true, x: 25, z: -3.4, title: 'x3 Cargo Belts', price: '$400,000', yaw: -Math.PI / 2, needs: 'airBelt', later: true, rebirth: 3 },
  ],
  rings: [
    { own: true, x: 24.3, z: 4.5, r: 1.5, color: '#f2d531', text: 'EXPAND', yaw: Math.PI / 2, buy: 'tunnel' },
    { own: true, x: 89.8, z: 4.5, r: 1.8, color: '#f2d531', text: 'EXPAND', yaw: Math.PI / 2, buy: 'airstrip' },
    { own: true, x: 21.9, z: -3.4, r: 1.5, color: '#25c7f2', text: 'BUY', yaw: Math.PI / 2, buy: 'airBelt' },
    { own: true, x: 21.9, z: -3.4, r: 1.5, color: '#25c7f2', text: 'BUY', yaw: Math.PI / 2, buy: 'airBeltFast' },
    { own: true, x: 103.4, z: 5.6, r: 1.9, color: '#f2c531', text: 'CARGO', yaw: Math.PI / 2, dark: true, cargo: 'pile' },
    { own: true, x: 20.6, z: 1.4, r: 1.5, color: '#f2c531', text: 'CARGO', yaw: Math.PI / 2, dark: true, cargo: 'belt' },
    { own: true, x: 152, z: -14.5, r: 2.4, color: '#25c7f2', text: 'HANGAR', yaw: 0.05 },
    { own: true, x: 18.4, z: -10.4, r: 1.7, color: '#25c7f2', text: 'LINKS', yaw: Math.PI / 2 },
  ],
  // The models (yard/aircraft.js), nose along +Z. No windows behind the flight deck: these carry wood.
  // `w` / `h` = half the hold's width and height, `box` = how square its corners are (2 = round),
  // `gear` = wheels to belly, `bogies` = wheels a side, `tail` = 'twin', 'fin' or 'T'.
  planes: {
    mule: { len: 16, w: 1.55, h: 1.55, box: 6, span: 23, chord: [3, 1.5], sweep: 0, gear: 1.3, tail: 'twin', fixed: true, bogies: 1, tyre: 0.72, paint: '#e7b416', trim: '#2b2d33', belly: '#4b4f58', stripe: '#c92f26', engines: [{ type: 'prop', x: 4.4, blades: 4, r: 2 }, { type: 'prop', x: -4.4, blades: 4, r: 2 }] },
    hauler: { len: 25, w: 2.4, h: 2.4, box: 3.4, span: 34, chord: [4.6, 2.2], sweep: 0.7, gear: 0.95, tail: 'fin', bogies: 2, tyre: 0.7, paint: '#7c8a5a', trim: '#e0a722', belly: '#4b5637', stripe: '#2b2d33', engines: [{ type: 'prop', x: 6, blades: 6, r: 2.3 }, { type: 'prop', x: -6, blades: 6, r: 2.3 }, { type: 'prop', x: 11.4, blades: 6, r: 2.3 }, { type: 'prop', x: -11.4, blades: 6, r: 2.3 }] },
    lifter: { len: 33, w: 3.1, h: 3.2, box: 3, span: 39, chord: [6.4, 2.2], sweep: 5.2, gear: 1.2, tail: 'T', bogies: 3, tyre: 0.82, paint: '#e4e7ea', trim: '#b5261e', belly: '#8f949c', stripe: '#2b2d33', winglet: true, engines: [{ type: 'jet', x: 7.6, r: 1.25, len: 5 }, { type: 'jet', x: -7.6, r: 1.25, len: 5 }, { type: 'jet', x: 13.2, r: 1.25, len: 5 }, { type: 'jet', x: -13.2, r: 1.25, len: 5 }] },
    titan: { len: 41, w: 3.9, h: 4, box: 2.8, span: 44, chord: [8.4, 2.6], sweep: 6.8, gear: 1.5, tail: 'T', bogies: 4, tyre: 0.98, paint: '#25406e', trim: '#e0a722', belly: '#b9bcc0', stripe: '#f4f5f7', winglet: true, engines: [{ type: 'jet', x: 8.6, r: 1.75, len: 6.6 }, { type: 'jet', x: -8.6, r: 1.75, len: 6.6 }, { type: 'jet', x: 15, r: 1.75, len: 6.6 }, { type: 'jet', x: -15, r: 1.75, len: 6.6 }] },
  },
  // The flight, m/s and m. `rotate` = speed it lifts off at, `climb` = rad up, `top` = height it is
  // gone at, `from` / `down` = where the approach starts and where the wheels touch.
  flight: {
    taxi: 15, taxiBack: 34, turnSpeed: 10, accel: 14, brake: 8, rollBrake: 7,
    rotate: 36, climb: 0.2, top: 190, spool: 1.1, away: 1000,
    from: 1040, height: 118, down: 484, approach: 62, flare: 38,
    ramp: 0.9, // s the ramp takes
    settle: 0.5, // s a loaded plane stands with its ramp up before it taxis
    stopFor: 16, // m ahead of the nose it stops for the player while taxiing
  },
  fx: {
    motes: 70, drips: 14, // the tunnel's emitters
    dust: 320, flames: 200, // the one-shot pools
    blast: 70, // dust puffs when the hatch goes
  },
  fieldFrom: 30, // x past which a phone starts drawing the airport
  crewEvery: 3, // every crewEvery-th worker (the second, the fifth...) takes logs to the planes
  // What an item pays by air: `premium` times what it pays on a truck, and never less than `log`.
  // The rebirths and the plane's full load bonus apply.
  premium: 1.5,
  log: 45,
  patience: 30, // s after the first item before a plane goes with what it has (no full load bonus)
  tip: 0.12, // s between items leaving the bunker
}

YARD.saleSigns.push(...AIR.sales)
YARD.rings.push(...AIR.rings)
YARD.alerts.push({ x: 152, y: 16, z: -14.5 })
YARD.locked.push({ own: true, x: 30.75, z: 4.5, label: 'Rebirth 3', lockY: 5.2, labelY: 3.3, lock: 2.9, text: 1 })
// The Air Links have no sign of their own: the LINKS window sells them, stage by stage and floor by
// floor, at the floors' own prices.
for (const l of STAGE_LINKS) {
  ;[1, ...YARD.floors.priceMult].forEach((k, floor) => {
    const tag = (id) => (floor ? `${id}@${floor}` : id)
    YARD.saleSigns.push({ id: tag(l.id), own: true, panel: true, floor, title: `${l.name} Air Link`, price: money(l.price * k), needs: tag(l.sale), also: 'airBelt', later: true, rebirth: AIR.rebirth, x: 0, z: 0, yaw: 0 })
  })
}

// Over the mouth of the trench.
export const overShaft = (x, z, margin = 0) => x > AIR.tunnel.west - margin && x < AIR.tunnel.portal + margin && Math.abs(z - AIR.tunnel.z) < AIR.tunnel.half + margin
// Inside the perimeter fence.
export const insideAirport = (x, z) => x > AIR.compound.west && x < AIR.compound.east && z > AIR.compound.north && z < AIR.compound.south

export const SPAWN = { x: 0, y: 0.05, z: 0 }
export const SPAWN_FACING = Math.PI - 0.146 // yaw on spawn: north, a touch east like the reference view

// The game rules: the chain is tree > logs on the ground > carried to LOGS IN > Debarker >
// conveyor > Sawmill > Kiln > Bundler > (from Rebirth 1) Workshop > pallet > carried to a
// truck's SELL ring, or straight onto the trucks by the Truck Conveyer.
export const GAME = {
  // Upgrade boards. value(level) = base + step * level, up to `max` levels (the row's six
  // pips); each level multiplies the price by `growth`. Rows in YARD name these by `id`.
  upgrades: {
    walkSpeed: { base: 16, step: 2, unit: '', price: 20, growth: 1.8, max: 6 },
    carry: { base: 1, step: 1, unit: ' logs', price: 50, growth: 2.2, max: 6 },
    axe: { base: 1, step: 1, unit: ' dmg', price: 30, growth: 2.4, max: 6 },
    workerSpeed: { base: 12, step: 2, unit: '', price: 200, growth: 2, max: 6 },
    workerCarry: { base: 1, step: 1, unit: ' logs', price: 250, growth: 2.2, max: 6 },
    workerAxe: { base: 1, step: 1, unit: ' dmg', price: 400, growth: 2.2, max: 6 },
    treesNeeded: { base: 100, step: -10, unit: ' trees', price: 1500, growth: 2, max: 6 },
    hauntTime: { base: 30, step: 10, unit: 's', price: 1000, growth: 2, max: 6 },
    luck: { base: 100, step: 50, unit: '%', price: 200, growth: 3, max: 6 },
    regrow: { base: 25, step: -3, unit: 's', price: 10000, growth: 2, max: 6 },
    // The Truck Depot's two rows (windows/depot.js).
    truckLevel: { base: 0, step: 1, unit: '', price: 25000, growth: 10, max: 3 }, // into GAME.trucks.levels
    delivery: { base: 9, step: -1.2, unit: 's', price: 500, growth: 4, max: 5 }, // s a truck is gone
    // The Hangar's two rows (windows/hangar.js).
    aircraft: { base: 0, step: 1, unit: '', price: 120000, growth: 8, max: 3 }, // into GAME.aircraft
    flightTime: { base: 20, step: -3, unit: 's', price: 15000, growth: 3, max: 5 }, // s a plane is out of sight
  },
  speedPerPoint: 1 / 16, // PHYSICS speeds are for the board's starting 16
  workerSpeedPerPoint: 1 / 3, // m/s per point of Worker Speed

  // Most common last. `chance` is % at 100% Tree Luck; luck multiplies every rare one.
  trees: [
    { id: 'rainbow', name: 'Rainbow Tree', tag: 'RAINBOW TREE', logs: 8, hp: 16, chance: 1, scale: 1.25, color: '#ff7be0', outline: '#5a1450' },
    { id: 'golden', name: 'Golden Tree', tag: 'GOLDEN TREE', logs: 5, hp: 10, chance: 4, scale: 1.15, mult: 3, color: '#ffd84a', outline: '#5a4410' },
    { id: 'big', name: 'Big Tree', tag: 'BIG TREE', logs: 3, hp: 6, chance: 15, scale: 1.5, color: '#7dff8a', outline: '#123d22' },
    { id: 'oak', name: 'Tree', logs: 2, hp: 3, scale: 1, color: '#ffffff' },
  ],
  lockedFrom: 11, // trees south of this z stay closed until More Forest is bought
  reach: 3.3, // m from the player to a trunk they can hit
  swingTime: 0.5, // s between axe swings
  hitAt: 0.55, // share of a swing where the blade lands
  fallTime: 0.9, // s a felled tree takes to go over
  growTime: 1.6, // s a tree takes to rise once its regrowth is up
  maxGroundLogs: 40, // workers stop felling here; past it the oldest log rots away
  logArea: { west: 22, east: 36, north: -23.8, south: 41.5 }, // logs land inside the fence, where hands can reach
  pickupRange: 1.9, // m from the player to a log they pick up by walking over it
  dockRange: 3.6, // m from the player to a pallet they take from
  loadEvery: 0.14, // s between items moving in or out of the player's hands

  // What one item is worth, before a lucky truck and the rebirth multiplier. `room` = m kept
  // to the item ahead on a belt, for those longer than GAME.line.gap.
  products: {
    log: { value: 6, room: 3.3 },
    debarked: { value: 10, room: 3.3 },
    plank: { value: 30, room: 2.9 },
    dried: { value: 80, room: 2.9 },
    bundle: { value: 240, room: 2.9 },
    chair: { value: 600 },
    table: { value: 1600, room: 3.1 },
    bed: { value: 4000, room: 3.9 },
  },
  // The Workshop's slot, cheapest first: buying a tier swaps the building and what it makes.
  workshopTiers: { tables: 'table', beds: 'bed' },
  rebirthCash: 2, // every rebirth multiplies all sales by this

  // The crew's pay while the player is gone (game.crewIncome). `share` of what the yard would have
  // made, for at most `cap` s; under `minAway` s away is nothing. `trip` = m a worker walks per load,
  // the felling included, measured off a fixed-step run of the yard.
  offline: { share: 0.5, cap: 8 * 3600, minAway: 60, trip: 60 },

  // The line: south down the east of the concrete, then west along its south edge (`path`,
  // [x, z] corners from the head of the first belt). `mouth` = m from a machine's centre to
  // where an item goes in or comes out, `belt` = m to the end of its outgoing belt, `time` = s
  // per item, `dock` = the pallet it can output to.
  line: {
    x: 12.4,
    path: [[12.4, -17.9], [12.4, 38.2], [-9.1, 38.2]],
    beltY: 1.65, // height of the belt surface, the same on every model
    speed: 3.4, // m/s
    gap: 1.7, // m kept between items on a belt
    feed: { x: 12.4, z: -19.7 }, // the pile at the head of the first belt
    feedStand: { x: 14.6, z: -20.4 }, // where workers stand to tip logs onto it
    pileMax: 24,
    dockMax: 12,
    handIn: 1.6, // m before a machine's mouth that hand-carried items go on its belt
    handStand: 2.8, // m to the side of the belt a worker stands to put them there
    turbo: 2, // Debarker Turbo's speed multiplier
    turboSign: 8.6, // height of its floating signs: the flue is taller than the plain Debarker
    machines: [
      { id: 'debarker', name: 'Debarker', z: -12.5, mouth: 2.3, belt: 5.8, time: 1.2, out: 'debarked', dock: { x: 9.6, z: -5.1 }, sign: 6.8 },
      { id: 'sawmill', name: 'Sawmill', z: 2.8, mouth: 2.3, belt: 5.8, time: 1.6, out: 'plank', dock: { x: 9.6, z: 10.6 }, sign: 6.4 },
      { id: 'kiln', name: 'Kiln', z: 18.6, mouth: 3.4, belt: 6, time: 2.2, out: 'dried', dock: { x: 9.6, z: 27.7 }, sign: 8.4 },
      { id: 'bundler', name: 'Bundler', z: 34.6, mouth: 1.4, belt: 2.5, time: 2.6, out: 'bundle', dock: { x: 12.4, z: 40.1 }, sign: 6.2 },
      { id: 'workshop', name: 'Workshop', x: -4, z: 38.2, mouth: 2.5, belt: 5.1, time: 3, out: 'chair', dock: { x: -8.6, z: 33.8 }, sign: 6.6 },
    ],
    // The bought belts between machines, z from and to.
    links: [
      { id: 'conveyor1', from: -6.7, to: -3 },
      { id: 'conveyor2', from: 8.6, to: 12.6 },
      { id: 'conveyor3', from: 24.6, to: 31 },
      { id: 'conveyor4', corner: { x: 12.4, z: 38.2 }, toX: 1.1 }, // round the corner to the Workshop
    ],
    // The Truck Conveyer: from the end of the Workshop's belt up onto stilts and north past
    // every truck, [x, y, z] of the belt surface. It drops into the first truck that can load.
    sky: { path: [[-9.1, 1.65, 38.2], [-9.8, 1.65, 38.2], [-9.8, 1.65, 36.4], [-9.8, 5, 28], [-9.8, 5, -22]], legEvery: 8 },
    // Off the Truck Conveyer's flat at its head, west to a chute over the rail.
    trainBelt: [[-9.8, 5, 27.4], [-23.4, 5, 27.4]],
    // An upper floor's Truck Lifter, null = that floor's belt height, and how far along the
    // Truck Conveyer its foot joins.
    truckLift: [[-9.1, null, 38.2], [-9.8, null, 38.2], [-9.8, 1.65, 38.2]],
    liftJoin: 0.7,
    speedBoost: 2, // x2 Conveyer Speed, on belts and machines alike
    // The Bay Conveyers (yard/feeds.js): each runs from the end of a machine's belt, up an incline
    // and along a gallery to a gantry crane that sets items on its own bay's truck. `backlog` =
    // items the next machine must have to get through before the kicker sends one off, so only
    // what it can't keep up with leaves the line. `climb` = m on the plan the incline takes, about
    // 26 degrees, which needs the cleats; `trestles` = m on the plan from the belt that a bent
    // stands, the last one measured back from the head; `kick` = s the kicker is out.
    feeds: {
      backlog: 4,
      top: 7, // clears the tallest item on the Truck Conveyer, under the Second Floor
      climb: 10.7,
      head: -8.4,
      trestles: [5, 9.8, 16],
      headTrestle: 0.3,
      width: 1.5,
      cleatEvery: 1.2, // m per repeat of the belt's texture
      kick: 0.4,
      flap: 1.3, // m of the climb the kicker's flap covers
      // The bay's crane: portal legs either side of the head, boom from `tail` out to `reach`.
      // `lift` = hook height it travels at, clear of the Truck Conveyer's tallest item, `hang` = m
      // from the hook to an item's top, `trolley` and `hoist` = m/s.
      crane: { legX: -8.1, legZ: 2, boomY: 10.4, topY: 11.3, mastY: 14, reach: -20, tail: -3.8, lift: 8.6, hang: 0.34, trolley: 10, hoist: 12 },
      list: [
        { sale: 'feed0', stage: 0, bay: 1, note: 'Spare debarked logs now ride straight to Truck Bay 2' },
        { sale: 'feed1', stage: 1, bay: 2, note: 'Spare planks now ride straight to Truck Bay 3' },
        { sale: 'feed2', stage: 2, bay: 3, note: 'Spare dried planks now ride straight to Truck Bay 4' },
      ],
    },
  },

  // Wood Lifters, one tower per upper floor beside the log pile. A level: `load` logs a trip, m/s.
  lifter: {
    half: 1.05,
    spots: [{ x: 10.2, z: -22.9 }, { x: 14.6, z: -22.9 }],
    levels: [{ load: 3, speed: 5 }, { load: 5, speed: 8 }, { load: 8, speed: 12 }],
    tipEvery: 0.2,
    rest: 0.6, // s at the bottom between trips
  },

  // Step lifters, one tower per belt, past the east edge of the decks. They move an item off the
  // end of a machine's belt once its next machine has `gap` more to do than another floor's.
  stepLifter: {
    x: 17.85,
    gap: 2,
    linger: 0.5, // s a cage waits for more before it sets off
    levels: [{ load: 2, speed: 4 }, { load: 5, speed: 8 }],
  },

  trucks: {
    // By Truck Level: `items` before it drives off, `bonus` = % of a full load's value paid on top.
    // The last is the OP Truck: SHOP sells it, past the Depot's `max`. `trip` scales its time away
    // and, by its inverse, how fast it drives.
    levels: [
      { name: 'STARTER TRUCK', items: 10, bonus: 0, rig: 'starter' },
      { name: 'BIG RIG', items: 14, bonus: 40, rig: 'bigRig' },
      { name: 'LOG LOADER', items: 18, bonus: 90, rig: 'logLoader' },
      { name: 'TITAN HAULER', items: 24, bonus: 140, rig: 'titan' },
      { name: 'OP TRUCK', items: 30, bonus: 200, rig: 'op', trip: 0.5 },
    ],
    drive: 7.5, // s each way on the road: a bay is empty for this twice plus its Delivery Time
    settle: 0.8, // s a full truck waits for the last item to land
    tailX: -10.6, // x every parked truck's tail stops at, just west of the Truck Conveyer's legs
    // Out through its gate, north up the east lane; back south down the west lane, past the gate,
    // then a reverse over the east lane into the bay. Metres and seconds.
    route: {
      x0: -8, // x every route in a bay starts from
      laneOut: -33, laneIn: -39,
      turnOut: 7, // m radius onto the road
      turnBack: 9, // m radius of the reverse
      backStop: 2.5, // m the trailer stays clear of that bend before it reverses
      backWait: 0.9, // s it stands there
      reach: -230, // z where the road takes it out of sight
      horizon: 34, // m over which it shrinks into the distance there
      cruise: 30, yard: 6.5, reverse: 5.5, near: 13, nearZ: -60, // m/s; `near` south of nearZ
      accel: 5.5, brake: 7, ease: 0.6, // m/s2; it plans its stops at `ease` of its full brakes
      cornering: 3, // m/s2 sideways
      gears: [3, 7, 12, 18, 25], shift: 0.22, // m/s it changes up at, s the power is off
      gap: 2, // m it stops short of the player or another truck
      dive: 0.011, sway: 0.016, // cab pitch and roll per m/s2
    },
    bays: [{ x: -14.4, z: 0.8 }, { x: -14.4, z: 13 }, { x: -14.4, z: 23.4 }], // those bought, in order
  },

  // By Aircraft Level, as GAME.trucks.levels: `items` a flight, `bonus` = % paid on top of a full load.
  // `plane` names AIR.planes. A flight takes about a minute and carries a truck's load many times
  // over: even the first moves twice what a Starter Truck does, the last more than the OP Truck.
  aircraft: [
    { name: 'SKY MULE', items: 60, bonus: 20, plane: 'mule' },
    { name: 'TIMBER HAULER', items: 110, bonus: 60, plane: 'hauler' },
    { name: 'IRON LIFTER', items: 180, bonus: 120, plane: 'lifter' },
    { name: 'TITAN FREIGHTER', items: 300, bonus: 200, plane: 'titan' },
  ],

  // The crew crosses the line round its north end: `passage` is the two corners. Every
  // `haulEvery`-th worker hauls pallets before anything else, and once a pallet holds `haulAt`
  // items all of them do: goods waiting there earn nothing, more logs only add to the wait.
  crew: { passage: [[16.2, -20.4], [8.4, -20.4]], stand: 1.7, hitEvery: 0.65, haulEvery: 3, haulAt: 3, pickRange: 9, tipEvery: 0.25, standTruck: 1.4 },
  haunt: { multiplier: 2, foliage: '#9a5cff', log: '#c29aff' },
  rainbowSpeed: 0.25, // hue turns per second of a Rainbow Tree and its logs
  chips: { count: 80, life: 0.7, gravity: 16, size: 0.16, perHit: 7 },
  hints: {
    chop: 'Walk up to a tree and swing your axe',
    buy: 'Stand on the BUY ring to buy the Debarker',
    pick: 'Walk over the logs to pick them up',
    load: 'Carry the logs to the LOGS IN ring',
    wait: 'The Debarker strips them: take them from the pallet',
    sell: 'Bring them to the SELL ring at the truck',
    sellLogs: 'Sell logs at the SELL ring by the truck to afford the Debarker',
  },
}

// The new player tutorial (tutorial.js, guide.js). `stages` are saved as a count (backend
// `tutorial`, bounded by TUTORIAL_MAX): equip, load the truck, buy the Debarker, load the pile.
// A task's `touch` replaces `sub` while the touch controls are on screen, `{n}` is the logs in hand.
export const TUTORIAL = {
  stages: 4,
  carry: 3, // what the hands hold until it ends; after that it's Carry Capacity again
  logs: 3, // logs to bring to the truck, then to the pile
  saveWait: 8, // s to wait for the save before a server that won't answer is taken as a new player
  crossings: [-20.4, -5.1, 10.6, 26.2], // z of the gaps between the machines along GAME.line.x
  trail: { spacing: 2.4, speed: 3.2, start: 1.6, stop: 1.2, y: 0.14, max: 24, size: 0.95 },
  beacon: { size: 1, bob: 0.35, bobRate: 3, spin: 2, far: 18, farScale: 2.4 }, // scale grows up to farScale from `far` m out
  beaconHeight: { tree: 9.8, log: 2.4, ring: 3.2 }, // m to the arrow's tip above the ground; a tree's is times its scale
  colors: { fill: '#ffd83a', side: '#f2930f', edge: '#3a2300', ghost: '#ffd83a' },
  edge: { x: 0.92, y: 0.88, rx: 0.43, ry: 0.4, gap: 46 }, // on screen within x, y (of the half screen); else on this ellipse, `gap` px from the sides at least
  pointEvery: 0.2, // s between finding where a UI arrow's button is
  doneTime: 6, // s the closing card stays up
  skip: { key: 'KeyK', label: 'Skip tutorial', keyLabel: 'Skip tutorial (K)', sure: 'Skip? Press again', sureTime: 3 }, // two presses, within sureTime s
  tasks: {
    equip: { title: 'Equip your axe', sub: 'Press 1 or click the Axe slot', touch: 'Tap the Axe slot', point: '.hud-slot' },
    chop: { title: 'Chop down a tree', sub: 'Follow the arrows, then hold left click or F beside the tree', touch: 'Follow the arrows, then hold CHOP beside the tree', point: '.touch-btn.chop', beacon: 'tree' },
    timber: { title: 'Timber!', sub: 'Here come the logs' },
    pick: { title: 'Pick up the logs ({n})', sub: 'Walk over them: you can hold 3 for now', beacon: 'log' },
    truck: { title: 'Load the logs on the truck', sub: 'Walk onto the SELL ring', beacon: 'ring' },
    debarker: { title: 'Buy the Debarker', sub: 'Stand on the BUY ring and hold E', touch: 'Stand on the BUY ring and hold the prompt', point: '.interact.show', beacon: 'ring' },
    pile: { title: 'Load the logs on the pile', sub: 'Walk onto the LOGS IN ring', beacon: 'ring' },
  },
  done: { title: 'Tutorial complete!', sub: 'You hold 1 log again: buy Carry Capacity on the board' },
}

// HUD values for the buttons that have no rules yet (the money is real).
export const HUD = {
  money: 0,
  friendBoost: 10, // % more on every sale per Bloxity friend in the room (a guess)
  hotbar: ['Axe'],
}

// Everything sold for Gems. Gems aren't in the game yet: `gems` is the price to use once they are,
// and until then `money` is what it costs, times the rebirth multiplier if `scales` (a boost is
// worth more the more the yard earns). `cash` and `speed` multiply sales and the line, for
// `seconds` on a timed boost, and a Rebirth 0 boost roughly pays for itself twice over.
export const SHOP = {
  hacker: { title: 'The Hacker', gems: 399, money: 2500000, cash: 2 },
  opTruck: { title: 'The OP Truck', gems: 69, money: 5000000 }, // above the Titan's $2.5M level
  autoChop: { title: 'Auto Chop', gems: 39, money: 12000 },
  x2Money: { title: 'x2 Money', gems: 11, money: 24000, scales: true, seconds: 300, cash: 2 },
  rush: { title: 'Rush Hour', gems: 19, money: 10000, scales: true, seconds: 90, cash: 2, speed: 2 },
  allGifts: { gems: 59, money: 8000 }, // more than the gifts' $7,600, or buying it would print money
  skipRebirth: { gems: 45, goals: 3 }, // money = this many of the rebirth's goals
  // These go past Max Workers, up to `hireCap` in all.
  hireCap: 30,
  hirePacks: [
    { n: 1, gems: 45, money: 40000, look: 'violet' },
    { n: 3, gems: 85, money: 90000, look: 'orange' },
    { n: 5, gems: 139, money: 180000, look: 'rainbow' },
    { n: 10, gems: 225, money: 350000, look: 'prism' },
  ],
}

// Audio (audio/). Everything is synthesised. Ranges are [m at full level, m where it is silent] from
// the player: past the second number a sound does not exist, and it falls by the square of the way
// there, so a machine is gone well before its range sounds like it should be.
export const AUDIO = {
  volume: 0.8,
  storageKey: 'lumber-empire.sound',
  buses: { ui: 0.8, sfx: 0.9, amb: 0.55, engine: 0.5 }, // per-bus levels before the master
  duck: 0.45, // world level while a menu window is open
  // Over everything on the way out: the top end taken down, so nothing can get thin or piercing.
  soft: { shelf: 4200, cut: -9, top: 10000 },
  air: [420, 5200], // Hz a sound is low-passed to at the far end of its range and right beside it
  width: 0.7, // how far a sound off to one side pans
  // One-shots.
  ranges: { chop: [7, 30], fall: [14, 52], land: [3, 14], horn: [10, 38], air: [5, 22], blast: [14, 90], door: [6, 46], touch: [24, 190], hold: [5, 32], kick: [3, 18] },
  // The running sounds (loops.js). `level` beside it, `rate` playback speed from stopped to flat out.
  // Only the nearest of a kind plays, and a machine only sounds while it has work inside it.
  voices: {
    debarker: { level: 0.75, range: [3.5, 13] },
    sawmill: { level: 0.75, range: [3.5, 13] },
    kiln: { level: 0.6, range: [3.5, 13] },
    bundler: { level: 0.65, range: [3, 12] },
    workshop: { level: 0.65, range: [3, 12] },
    belt: { level: 0.3, range: [1.5, 7] },
    diesel: { level: 0.7, range: [7, 30], idle: 0.3, idleRange: [2.5, 9], rate: [0.75, 1.75] },
    train: { level: 0.8, range: [8, 33], rate: [0.65, 1.2] },
    prop: { level: 0.8, range: [22, 240], rate: [0.45, 1.25] },
    jet: { level: 0.85, range: [26, 280], rate: [0.5, 1.2] },
  },
  turbo: { rate: 1.14, level: 1.2 }, // the Debarker once it is the Turbo
  spin: { up: 0.6, down: 1.4, droop: 0.82 }, // s to run up and down, and the pitch it runs down to
  // The ear stops noticing what it is left beside: `settle` s near a machine eases it to `rest`.
  settle: 12,
  rest: 0.5,
  voiceEvery: 0.066, // s between updates of the loops
  steps: {
    // thump Hz, gain, scuff Hz, scuff gain, scuff s, grains of grit and the band they fall in
    concrete: { thump: 170, gain: 0.34, scuff: 900, scuffGain: 0.05, scuffD: 0.03 },
    grass: { thump: 120, gain: 0.26, scuff: 1100, scuffGain: 0.07, scuffD: 0.07, grains: 3, grit: 0.03, band: [700, 2200] },
    needles: { thump: 130, gain: 0.28, scuff: 800, scuffGain: 0.06, scuffD: 0.06, grains: 4, grit: 0.05, band: [500, 1900] },
    gravel: { thump: 140, gain: 0.3, scuff: 1000, scuffGain: 0.07, scuffD: 0.06, grains: 6, grit: 0.07, band: [600, 2400] },
    wood: { thump: 150, gain: 0.34, scuff: 700, scuffGain: 0.03, scuffD: 0.025, knock: 190 },
  },
  ambience: {
    wind: 0.2, // the low steady air
    leaves: 0.2, // pines moving, right beside the forest
    leavesRange: [4, 30], // m from the trees
    night: 0.65, // how much of the wind is left at night
    gust: [5, 13], // s between changes of the wind
    calls: [22, 55], // s between a bird far off
    tunnel: 0.5, // the hum of the rock round the tunnel
    drips: [1.6, 5], // s between drops falling in the dark
    echo: 0.55, // reverb on feet underground
  },

  maxVoices: 48, // one-shot sounds at once before low-priority ones are skipped
  maxVoicesTouch: 24,
  // Output buffer (s, the AudioContext latencyHint) and how far ahead each one-shot is scheduled, so
  // a short main-thread stall doesn't crackle or clip its start.
  latency: 0.04,
  latencyTouch: 0.07,
  lead: 0.02,
  // Generated impulse response: pre-delay s, early reflections [ms, gain], tail decay s (to -60 dB),
  // tail level, how fast the tail darkens, and the default send level.
  reverb: { seconds: 1.8, preDelay: 0.012, early: [[19, 0.5], [31, 0.35], [47, 0.28], [73, 0.2], [97, 0.12]], decay: 1.4, tail: 0.18, darken: 1.6, send: 0.9 },
}

// Placeholder window values (windows/), kept in memory until the game rules and saves exist.
export const WINDOWS = {
  gifts: {
    played: 0, // s online at the start
    crateName: 'Employee Crate',
    // Top to bottom. `at` = s online the gift needs, `tone` = its card (windows.css).
    rows: [
      [
        { at: 60, money: 400, tone: 'mint' },
        { at: 180, money: 600, tone: 'pink' },
        { at: 300, money: 800, tone: 'pink' },
        { at: 420, crates: 1, tone: 'pink' },
      ],
      [
        { at: 600, money: 1200, tone: 'green' },
        { at: 1200, money: 1600, tone: 'green' },
        { at: 2100, crates: 1, tone: 'green' },
      ],
      [{ at: 3600, money: 3000, crates: 1, tone: 'blue' }],
    ],
  },
  rebirth: {
    goal: 20000, // money the first rebirth needs
    goalGrowth: 2, // each rebirth multiplies the goal
    unlocks: ['THE WORKSHOP', 'TRUCK BAY 3, BAY 2 CONVEYER AND TRAIN LOADER', 'BAY 3 CONVEYER, THE TUNNEL AND THE AIRPORT', null, 'TRUCK BAY 4 AND BAY 4 CONVEYER'], // what rebirth n + 1 opens, in order
  },
  hire: {
    workers: 0, // the crew starts empty: the first worker is bought at the HIRE ring
    maxWorkers: 5,
    price: 100, // the first hire; cheap enough to afford from the first logs sold
    priceGrowth: 2, // each hire multiplies the price
  },
  // Each truck rolls once every time it pulls in; everything on a lucky one pays `mult`.
  depot: {
    lucky: [{ name: 'GOLD', chance: 15, mult: 2, color: '#ffd84a' }, { name: 'RAINBOW', chance: 5, mult: 5, rainbow: true }],
    portrait: { size: 320, fov: 26, distance: 21, sun: 2.6, background: '#26201e' },
  },
  hangar: { portraitDistance: 2.15 }, // the plane's length times this
  // A nameless entry shows as ???; `owned` = how many the player has.
  index: {
    note: 'All your workers become your best <em>employee</em>! Get crates from the <em>train</em>',
    list: [
      { name: 'Hard Hat', rarity: 'Common', mult: 1.1, owned: 2, hat: 'hardhat' },
      { rarity: 'Common', mult: 1.15, hat: 'cap' },
      { rarity: 'Uncommon', mult: 1.25, hat: 'tall' },
      { rarity: 'Uncommon', mult: 1.35, hat: 'cap' },
      { rarity: 'Rare', mult: 1.5, hat: 'cap' },
      { rarity: 'Rare', mult: 1.75, hat: 'tall' },
      { rarity: 'Epic', mult: 2.25, hat: 'cap' },
      { rarity: 'Legendary', mult: 3, hat: 'cap' },
      { rarity: 'Admin', mult: 2.5, hat: 'horns' },
      { rarity: 'Admin', mult: 3.5, hat: 'spikes' },
      { rarity: 'Admin', mult: 5, hat: 'crown' },
      { rarity: 'Secret', mult: 10, hat: 'wide' },
    ],
  },
}

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 8, // m/s
  sprintSpeed: 14, // m/s with Shift held
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -14, // sank this far: respawn. Under the tunnel's floor (AIR.tunnel)
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // capsule the character controller moves

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
export const FOG = { near: 55 } // far is the graphics preset's `fog`
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    zenith: '#6db4ec',
    horizon: '#d3ebf1',
    sunColor: '#fff5c8',
    // The reference's look: a warm sun over a strong blue ambient, so shadows on the
    // pale concrete read as saturated blue instead of grey.
    sunIntensity: 3.55,
    sunElevation: 42, // degrees above the horizon
    sunAzimuth: 135, // degrees, 0 = from +Z; 135 = from the north-east
    hemiSky: '#9daeff',
    hemiGround: '#5a6a8a',
    hemiIntensity: 1.1,
    envIntensity: 0.22,
    lampIntensity: 0,
    stars: 0,
    exposure: 1,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 62, // half-width of the sun's shadow box around the player
  shadowDistance: 150, // m the sun sits from the player, up its own direction
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
// view = m from a neighbour's fence past which its yard isn't drawn, fog = where the fog closes so it
// is gone by then, liveYards = how many neighbours may be the real thing at once (yard/plots.js),
// standInShadows = whether their stand-ins cast shadows.
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35, view: 170, fog: 240, liveYards: 1, standInShadows: false },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6, view: 230, fog: 340, liveYards: 1, standInShadows: false },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1, view: 320, fog: 620, liveYards: 2, standInShadows: true },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1, view: 400, fog: 620, liveYards: 3, standInShadows: true },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6, view: 230, fog: 340, liveYards: 1 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles), view: Math.min(p.view, cap.view), fog: Math.min(p.fog, cap.fog), liveYards: Math.min(p.liveYards, cap.liveYards), standInShadows: false }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  portraitWidth: 58, // degrees across a tall screen keeps, by widening the vertical FOV...
  maxFov: 95, // ...up to this
  near: 0.1,
  far: 1200,
  startPitch: 0.56, // radians above the horizon (the reference's high chase cam)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 17, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 30,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
  shakeFade: 5, // 1/s a shake dies away
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  master_volume: { def: '80', type: 'number', min: 0, max: 100 },
}

// Boxity's ads (bloxity.js). Screen ads sit on the edges round a window, so a screen narrower than
// `panelMinWidth` px, with no edges to spare, shows none.
export const ADS = {
  panelMinWidth: 900,
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  emoteFade: 0.2, // s an emote takes to blend in and out
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
  // Overlaid on any of the above: a carried load and the axe swing. Negative x lifts an arm forward.
  work: {
    carryRate: 12, carryArm: deg(-68), carryElbow: deg(-18),
    windUp: 0.5, // share of the swing spent lifting the axe
    swingArm: deg(-165), strikeArm: deg(-40), swingOut: deg(-14), swingElbow: deg(-20), swingLean: deg(8), swingTwist: deg(12),
  },
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// Hold-E prompt at the BUY rings (and the Hacker / OP Truck rings): hold E this long to buy.
export const INTERACT = { holdMs: 600, key: 'KeyE' }
