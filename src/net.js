// Colyseus link to Lumber-empire-backend (room "world", six players, one yard each). The server
// holds the player's ONLY save: nothing about progress is kept in the browser. On join the server
// answers with `progress` (the saved doc), `noProgress` (new account, guest or no database: keep the
// fresh state and save it) or `serverError` (the save could not be read: never overwrite it). From
// then on the whole snapshot is sent as `saveProgress` whenever it changed, at most every
// NET.saveEvery s, and when the tab hides or closes. Guests (not signed in to Bloxity) are never
// saved by the server, so their progress lasts the page.
// Never throws and never blocks play: with no server (or an unreachable one) the game runs on a
// fresh, unsaved state and keeps trying to connect.
import { Client } from '@colyseus/sdk'
import { DEV_MODE, NET, SERVER_URL } from './config.js'
import {
  authState,
  canResolveServer,
  getAuthToken,
  getEquippedAvatar,
  getPfp,
  getProportions,
  launchRoomId,
  locateRoom,
  resolveServerEndpoint,
  subscribeAuth,
  updateRoom,
} from './bloxity.js'

export const net = {
  room: null,
  connected: false,
  hydrated: false, // a progress/noProgress answer arrived: saving is allowed
  joinedAt: 0, // performance.now() of the last join
  get sessionId() {
    return this.room?.sessionId ?? null
  },
  // The yard this player owns, -1 until the server has said.
  get slot() {
    return this.room?.state?.players?.get?.(this.sessionId)?.slot ?? -1
  },
}

// --- Identity ----------------------------------------------------------------
// Signed-in players use their Bloxity id; everyone else a per-browser guest id (never saved).
// Dev mode (no SDK) plays as a per-tab signed-in dev id, so a local server with Mongo keeps its
// progress across reloads and two tabs are two players (the server evicts a second session of one
// account). Only these ids are stored in the browser, never progress.
function storedId(store, key, make) {
  try {
    let id = store.getItem(key)
    if (!id) store.setItem(key, (id = make()))
    return id
  } catch {
    return make()
  }
}
const rand = () => Math.random().toString(36).slice(2, 8)
const GUEST = storedId(localStorage, 'lumber-empire.guest', () => `guest-${rand()}`)
const DEV = DEV_MODE ? storedId(sessionStorage, 'lumber-empire.dev', () => `dev-${rand()}`) : ''

function identity() {
  if (DEV) return { userId: DEV, username: `Dev ${DEV.slice(4)}` }
  const u = authState.user
  const id = u && (u._id || u.id || u.userId || u.uid)
  if (!id) return { userId: GUEST, username: authState.guest?.displayName || authState.guest?.username || 'Guest' }
  return { userId: String(id), username: String(u.displayName || u.username || u.name || 'Player'), token: getAuthToken() }
}

// --- Saving ------------------------------------------------------------------
let lastSaved = ''
let savedAt = 0
let sentId = '' // identity the server currently attributes saves to
let loadedId = '' // identity whose saved progress this tab has already loaded
let source = null // initNet's: { snapshot() -> the save, hydrate(doc), plot() -> the yard as JSON-able data }

const isGuest = () => sentId.startsWith('guest-')

function hydrate(doc) {
  try {
    source?.hydrate(doc)
  } catch (err) {
    console.warn('[net] hydrate failed', err)
  }
}

export function saveNow() {
  if (!net.connected || !net.hydrated || isGuest() || !source) return
  const snap = JSON.stringify(source.snapshot())
  if (snap === lastSaved) return
  lastSaved = snap
  savedAt = performance.now()
  send('saveProgress', JSON.parse(snap))
}

function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}

// Handlers registered here are attached to every room this tab joins (reconnects included).
const handlers = []
export function onNetMessage(type, fn) {
  handlers.push([type, fn])
  net.room?.onMessage(type, fn)
}

// --- Presence ----------------------------------------------------------------
// What the others need to draw this player and their yard. The latest of each also rides on the
// join options, so a (re)join shows up right away. The roster (`net.room.state.players`) carries
// everyone's.
const AVATAR_MAX = 3000 // backend AVATAR_MAX_LEN
// The signed-in player's look as JSON { equipped, proportions }: ids only, each client builds the
// URLs itself. "" = the default character.
function avatarJson() {
  if (!authState.user) return ''
  const equipped = getEquippedAvatar()
  if (!equipped) return ''
  try {
    const json = JSON.stringify({ equipped, proportions: getProportions() })
    return json.length <= AVATAR_MAX ? json : ''
  } catch {
    return ''
  }
}

const presence = { pose: null }
let poseKey = ''
let poseAt = 0
// { x, y, z, yaw, speed, swing, kind, count }: at most NET.poseHz a second, nothing while it stands still.
export function sendPose(pose) {
  presence.pose = pose
  if (!net.connected) return
  const now = performance.now()
  if (now - poseAt < 1000 / NET.poseHz) return
  const key = `${pose.x}|${pose.y}|${pose.z}|${pose.yaw}|${pose.speed}|${pose.swing}|${pose.kind}|${pose.count}`
  if (key === poseKey) return
  poseKey = key
  poseAt = now
  send('pose', pose)
}

let sentAvatar = ''
// The Bloxity look changed (customizer, sign-in/out): send it if it differs.
export function syncAvatar() {
  if (!net.connected) return
  const avatar = avatarJson()
  if (avatar === sentAvatar) return
  sentAvatar = avatar
  send('setAvatar', { avatar })
}

let sentPlot = ''
// The yard's purchases, for the others to build: sent when they change.
export function syncPlot() {
  if (!net.connected || !source) return
  const plot = JSON.stringify(source.plot())
  if (plot === sentPlot) return
  sentPlot = plot
  send('setPlot', { plot })
}

// Live yard frames (yard/sync.js).
export const sendYardFast = (frame) => net.connected && send('yardFast', frame)
export const sendYardSlow = (frame) => net.connected && send('yardSlow', frame)

// Everyone in the room (sessionId -> roster entry), null when offline. `mine` = this session's key.
export function roster() {
  const players = net.connected ? net.room?.state?.players : null
  if (!players) return null
  return { mine: net.sessionId, forEach: (fn) => players.forEach(fn) }
}

// --- Connection --------------------------------------------------------------
let sentPfp = '' // the profile picture the server shows the others (roster `pfp`)
function attach(room) {
  net.room = room
  net.connected = true
  net.joinedAt = performance.now()
  for (const [type, fn] of handlers) room.onMessage(type, fn)
  room.onMessage('progress', (doc) => {
    net.hydrated = true
    lastSaved = ''
    // A reconnect under the same identity: this tab is newer than the save (it may hold changes
    // not sent yet), so push it rather than load over it.
    if (loadedId === sentId || !doc) return saveNow()
    loadedId = sentId
    hydrate(doc)
    syncPlot()
    saveNow() // fills in whatever an older save lacked; a no-op send of the same values otherwise
  })
  room.onMessage('noProgress', () => {
    // New account, guest or no database: keep the local progress and push it as the first save.
    net.hydrated = true
    loadedId = sentId
    lastSaved = ''
    saveNow()
  })
  room.onMessage('serverError', () => {
    // The save exists but could not be read: never overwrite it.
    net.hydrated = false
    console.warn('[net] server could not read the saved progress; saving is off for this session')
  })
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    net.hydrated = false
    updateRoom('')
    // Resolve again rather than rejoin the old endpoint: that is how players move off a pod being
    // replaced. Keep trying; play is unaffected meanwhile.
    setTimeout(connect, NET.rejoin * 1000)
  })
  send('yardHello')
}

export const hasServer = () => !!(SERVER_URL || canResolveServer())

// The ?roomId= this page was opened with (Open Rooms Join / friend invite): tried on the first
// connect only, then normal matchmaking.
let launchRoom = launchRoomId()
async function joinLaunchRoom(options) {
  const id = launchRoom
  launchRoom = ''
  if (!id) return null
  try {
    if (SERVER_URL) return { room: await new Client(SERVER_URL).joinById(id.split('~').pop(), options), relay: '' }
    const at = await locateRoom(id)
    if (at) return { room: await new Client(at.endpoint).joinById(at.roomId, options), relay: at.relayRoomId }
  } catch (err) {
    console.info('[net] the invited room is gone or full; matchmaking instead', err?.message ?? err)
  }
  return null
}

// Deployed builds ask the matchmaker on every connect (a new Client per endpoint, each is pinned to
// one pod). userId lets it reuse this player's seat on retries; guest/dev ids are not Bloxity ids.
async function joinAnyRoom(options) {
  if (SERVER_URL) return { room: await new Client(SERVER_URL).joinOrCreate('world', options), relay: '' }
  const { endpoint, relayRoomId } = await resolveServerEndpoint(/^(guest|dev)-/.test(options.userId) ? undefined : options.userId)
  return { room: await new Client(endpoint).joinOrCreate('world', options), relay: relayRoomId }
}

let connecting = false
let retryIn = NET.retry // s: backoff while the matchmaker / server can't be reached
async function connect() {
  if (!hasServer() || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    sentPfp = getPfp()
    sentAvatar = avatarJson()
    sentPlot = source ? JSON.stringify(source.plot()) : ''
    poseKey = ''
    const options = { ...id, pfp: sentPfp, avatar: sentAvatar, plot: sentPlot, pose: presence.pose }
    const { room, relay } = (await joinLaunchRoom(options)) ?? (await joinAnyRoom(options))
    retryIn = NET.retry
    attach(room)
    // relay~room lets an invited friend join this exact room through its pod's relay (bloxity.js locateRoom).
    updateRoom(relay ? `${relay}~${room.roomId}` : room.roomId)
  } catch (err) {
    console.info(`[net] could not reach the server (retrying in ${retryIn}s); progress is not being saved`, err?.message ?? err)
    setTimeout(connect, retryIn * 1000)
    retryIn = Math.min(retryIn * 2, NET.retryMax)
  } finally {
    connecting = false
  }
}

// A changed snapshot is sent at most every NET.saveEvery s, while the tab is visible.
setInterval(() => {
  if (document.hidden) return
  if (performance.now() - savedAt >= NET.saveEvery * 1000) saveNow()
}, 1000)

// opts: { snapshot() -> the save, hydrate(doc), plot() -> the yard for the others }.
export function initNet(opts) {
  source = opts
  if (!hasServer()) return console.info('[net] no server configured; progress is not being saved')
  // The first ready call connects; later ones are sign-in / sign-out. Staying in the same room:
  // re-matchmaking here would pull the player out of their friends' world.
  subscribeAuth((s) => {
    if (!s.ready) return
    if (!net.connected) return void connect()
    const id = identity()
    sentPfp = getPfp()
    syncAvatar() // signed in / out: the others see the new look
    if (id.userId === sentId) return send('identify', { username: id.username, pfp: sentPfp })
    saveNow() // under the old id, before switching
    net.hydrated = false
    sentId = id.userId
    send('identify', { ...id, pfp: sentPfp })
  })
  // Closing or reloading is a deliberate leave: it gives the seat back at once, so a reload in a full
  // room comes back to the same world instead of finding it full of its own old seat.
  window.addEventListener('pagehide', () => {
    saveNow()
    try {
      net.room?.leave()
    } catch {
      // Going away anyway.
    }
  })
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
}
