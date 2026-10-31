import * as sfx from '../audio/sfx.js'
import { GAME } from '../config.js'
import { shortMoney } from '../hud.js'
import { ART } from './art.js'
import { createWindow } from './shell.js'

// What the crew earned while the player was gone. The money is already in the wallet by the time
// this shows, so closing it any way at all loses nothing.
const span = (s) => {
  const minutes = Math.floor(s / 60)
  const hours = Math.floor(minutes / 60)
  if (!hours) return `${minutes}m`
  return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`
}

export function createAway() {
  const win = createWindow({ title: 'Welcome Back!', className: 'w-away' })
  win.body.innerHTML = `
    <span class="aw-face">${ART.worker}</span>
    <p class="aw-note">While you were away for <b class="aw-time"></b></p>
    <p class="aw-note">your workers earned</p>
    <p class="aw-paid"></p>
    <button class="aw-go uiw-tap" type="button">Collect</button>`
  const time = win.body.querySelector('.aw-time')
  const paid = win.body.querySelector('.aw-paid')
  win.body.querySelector('.aw-go').addEventListener('click', () => {
    sfx.reward()
    win.close()
  })

  return {
    show(money, seconds) {
      time.textContent = seconds > GAME.offline.cap ? `${span(seconds)} (they stop at ${span(GAME.offline.cap)})` : span(seconds)
      paid.textContent = shortMoney(money)
      win.open()
    },
  }
}
