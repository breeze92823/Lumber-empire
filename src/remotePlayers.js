// The other players in the room, drawn in the world (after Clean-leaves-for-loot's remotePlayers.js):
// each is their Bloxity avatar with an axe and a name tag, eased toward the pose the server last
// relayed (net.js roster), plus speed x heading for the time since (dead reckoning). Poses come in
// the sender's own yard's coordinates, and plots.map says where that yard stands here, so a player
// is in the right place on everyone's screen wherever they have walked to. Diffed against the roster
// every frame, so joins, leaves and changes of look need no events.
import { Group } from 'three'
import { GAME, NET, PLOTS } from './config.js'
import { playerInRoom, playerJoined } from './bloxity.js'
import { buildAxe, giveAxe } from './avatar/axe.js'
import { composedSkinUrl } from './avatar/cdn.js'
import { buildDefaultCharacter } from './avatar/character.js'
import { buildLook } from './avatar/look.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { playEmote } from './avatar/emotes.js'
import { createBubble } from './bubble.js'
import { net, roster } from './net.js'
import { label } from './propkit.js'
import { isItemKind } from './yard/items.js'

const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
const NAME_Y = 3.6

class Remote {
  constructor(scene) {
    this.scene = scene
    this.group = new Group()
    this.group.visible = false
    scene.add(this.group)
    this.axe = buildAxe()
    this.avatar = null
    this.animator = null
    this.avatarJson = null // what the current rig was built from
    this.generation = 0
    this.name = null
    this.label = null
    this.bubble = createBubble(this.group, NAME_Y + 0.62)
    this.placed = false
    this.base = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, at: 0, key: '' }
    this.spot = { x: 0, z: 0, yaw: 0 }
    this.lastY = 0
    this.vy = 0
    this.swingLeft = 0
    this.wasSwinging = false
    this.kind = ''
    this.item = null
    this.emote = null // the roster's `emote` last seen; null until then, so an old one doesn't play
    this.setAvatar(buildDefaultCharacter())
  }

  setAvatar(next) {
    if (this.avatar) this.group.remove(this.avatar)
    disposeAnimator(this.animator)
    this.avatar = next
    next.traverse((o) => o.isMesh && (o.castShadow = false)) // shadow passes add up in a full room
    this.group.add(next)
    this.animator = makeAnimator(next)
    giveAxe(next, this.axe)
  }

  // A signed-in player's look arrives as JSON { equipped, proportions }, ids only: this client works
  // out the skin's URL as the docs say to for other players. "" = default.
  async syncAvatar(json) {
    if (json === this.avatarJson) return
    this.avatarJson = json
    const mine = ++this.generation
    if (!json) return this.setAvatar(buildDefaultCharacter())
    let look = null
    try {
      look = JSON.parse(json)
    } catch {
      return
    }
    try {
      const group = await buildLook({ equipped: look?.equipped, proportions: look?.proportions, skin: composedSkinUrl(look?.equipped) }, () => mine !== this.generation)
      if (group) this.setAvatar(group)
    } catch (err) {
      console.warn('[remote] avatar failed to load', err)
    }
  }

  syncName(p) {
    const name = p.username || 'Player'
    if (name === this.name) return
    this.name = name
    if (this.label) {
      this.group.remove(this.label)
      this.label.material.map?.dispose()
      this.label.material.dispose()
    }
    this.label = label(name, 0.5, { color: '#ffffff', outline: '#1a0a14', font: '700 64px Fredoka, sans-serif', outlineWidth: 10 })
    this.label.position.y = NAME_Y
    this.group.add(this.label)
  }

  update(p, dt, now, plots) {
    this.syncName(p)
    this.syncAvatar(p.avatar)
    this.bubble.update(dt)
    if (p.emote !== this.emote) {
      if (this.emote !== null) playEmote(() => this.animator, p.emote.split('#')[0])
      this.emote = p.emote
    }

    // A new pose resets the dead-reckoning base.
    const b = this.base
    const key = `${p.x}|${p.y}|${p.z}|${p.yaw}|${p.speed}`
    if (key !== b.key) Object.assign(b, { key, x: p.x, y: p.y, z: p.z, yaw: p.yaw, speed: p.speed, at: now })
    const ahead = Math.min((now - b.at) / 1000, NET.predictMax) * b.speed
    if (!plots.map(p.slot, b.x + Math.sin(b.yaw) * ahead, b.z + Math.cos(b.yaw) * ahead, b.yaw, this.spot)) return false
    const { spot } = this
    const g = this.group
    const far = Math.hypot(spot.x - g.position.x, spot.z - g.position.z) > 30
    const k = this.placed && !far ? 1 - Math.exp(-NET.remoteLerp * dt) : 1
    g.position.x += (spot.x - g.position.x) * k
    g.position.y += (b.y - g.position.y) * k
    g.position.z += (spot.z - g.position.z) * k
    g.rotation.y += angleDelta(g.rotation.y, spot.yaw) * k
    this.vy = this.placed && dt > 0 ? this.vy + ((g.position.y - this.lastY) / dt - this.vy) * Math.min(1, dt * 10) : 0
    this.lastY = g.position.y
    this.placed = true

    // The swing plays here from its start, since the server only samples it.
    const swinging = p.swing > 0
    if (swinging && !this.wasSwinging) this.swingLeft = GAME.swingTime
    this.wasSwinging = swinging
    this.swingLeft = Math.max(0, this.swingLeft - dt)
    const swing = this.swingLeft > 0 ? 1 - this.swingLeft / GAME.swingTime : 0
    const carrying = p.carryCount > 0
    this.animator?.update(dt, { grounded: Math.abs(this.vy) < 0.5, speed: b.speed, verticalVelocity: this.vy, turn: 0, carry: carrying, swing })
    this.axe.visible = !carrying || swing > 0
    return true
  }

  // Their hands, stacked in front of them (the same pile the player draws).
  draw(p, items) {
    // The server only checks the shape of `carryKind`, so it may name nothing this client can draw.
    if (!p.carryCount || !this.group.visible || !isItemKind(p.carryKind)) return
    if (p.carryKind !== this.kind) {
      this.kind = p.carryKind
      this.item = { kind: p.carryKind, mult: 1, tint: null, rainbow: false }
    }
    const { position: at, rotation } = this.group
    const yaw = rotation.y
    const fx = Math.sin(yaw) * 0.85
    const fz = Math.cos(yaw) * 0.85
    let y = at.y + 1.15
    for (let i = 0; i < p.carryCount; i++) {
      const r = items.rest(this.item) * 0.7
      items.add(this.item, at.x + fx, y + r, at.z + fz, yaw + Math.PI / 2, 0.7)
      y += r * 2
    }
  }

  dispose() {
    this.generation++ // an avatar still loading is dropped
    this.scene.remove(this.group)
    disposeAnimator(this.animator)
    this.bubble.clear()
    if (this.label) {
      this.label.material.map?.dispose()
      this.label.material.dispose()
    }
  }
}

export function createRemotePlayers(scene, plots) {
  const remotes = new Map() // sessionId -> Remote
  const listing = new Map() // sessionId -> roster entry, as of this frame

  function clear() {
    for (const r of remotes.values()) r.dispose()
    remotes.clear()
    listing.clear()
  }

  return {
    get count() {
      return remotes.size
    },
    // viewer: this player's drawn position.
    update(dt, viewer) {
      const players = roster()
      if (!players) return remotes.size && clear()
      const now = performance.now()
      listing.clear()
      players.forEach((p, id) => {
        if (id !== players.mine && p.slot >= 0 && p.slot < PLOTS.seats.length) listing.set(id, p)
      })
      for (const [id, p] of listing) {
        let r = remotes.get(id)
        if (!r) {
          remotes.set(id, (r = new Remote(scene)))
          // Whoever was here already when we arrived, or someone arriving now.
          const name = p.username || 'Player'
          if (now - net.joinedAt < 2000) playerInRoom(name)
          else playerJoined(name)
        }
        const on = r.update(p, dt, now, plots)
        r.group.visible = on && Math.hypot(r.group.position.x - viewer.x, r.group.position.z - viewer.z) < NET.avatarFade
      }
      for (const [id, r] of remotes) {
        if (listing.has(id)) continue
        r.dispose()
        remotes.delete(id)
      }
    },
    drawHands(items) {
      for (const [id, p] of listing) remotes.get(id)?.draw(p, items)
    },
    // A chat line from the Bloxity account `uid`.
    say(uid, text, seconds) {
      for (const [id, p] of listing) if (p.uid === uid) remotes.get(id)?.bubble.say(text, seconds)
    },
  }
}
