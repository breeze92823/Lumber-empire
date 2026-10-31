// Inline SVG art for the HUD (hud.js), drawn in the reference's glossy "simulator"
// style: bold shapes, gradient fills, a dark outline. Ids are prefixed by icon name.
const svg = (body, box = '0 0 100 100') => `<svg viewBox="${box}" aria-hidden="true">${body}</svg>`
const gradient = (id, stops, dir = 'x1="0" y1="0" x2="0" y2="1"') =>
  `<linearGradient id="${id}" ${dir}>${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`

export const ICONS = {
  // Gold basket holding a trophy, a dumbbell and a wad of cash.
  shop: svg(
    `<defs>${gradient('s-basket', [[0, '#ffd34a'], [1, '#f09b12']])}${gradient('s-cup', [[0, '#ffc64a'], [1, '#e8791a']])}${gradient('s-cash', [[0, '#67e04a'], [1, '#249c35']])}</defs>
    <path d="M18 8h20v4c5 0 9 3 9 8s-5 9-11 9l-2 5H22l-2-5c-6 0-11-4-11-9s4-8 9-8z" fill="url(#s-cup)" stroke="#7a3a08" stroke-width="2.5"/>
    <rect x="50" y="10" width="30" height="17" rx="5" transform="rotate(14 60 20)" fill="#9aa6bd" stroke="#2c3550" stroke-width="2.5"/>
    <rect x="44" y="20" width="34" height="23" rx="3" transform="rotate(-20 60 30)" fill="url(#s-cash)" stroke="#0f4a1d" stroke-width="2.5"/>
    <rect x="55" y="20" width="9" height="24" transform="rotate(-20 60 30)" fill="#f0c43a"/>
    <path d="M24 44h34" stroke="#3c4049" stroke-width="6" stroke-linecap="round"/>
    <rect x="11" y="30" width="15" height="26" rx="6" fill="#343946" stroke="#141720" stroke-width="2.5"/>
    <rect x="23" y="33" width="9" height="20" rx="4" fill="#4c5262" stroke="#141720" stroke-width="2.5"/>
    <rect x="51" y="33" width="9" height="20" rx="4" fill="#4c5262" stroke="#141720" stroke-width="2.5"/>
    <rect x="58" y="30" width="15" height="26" rx="6" fill="#343946" stroke="#141720" stroke-width="2.5"/>
    <path d="M3 44h94l-6 7-7 37a7 7 0 0 1-7 6H23a7 7 0 0 1-7-6L9 51z" fill="url(#s-basket)" stroke="#8a4a0a" stroke-width="3"/>
    <path d="M3 44h94l-5 8H8z" fill="#ffe27a" stroke="#8a4a0a" stroke-width="2.5"/>
    <path d="M26 58l3 28M40 58l1.5 28M54 58v28M68 58l-1.5 28M80 58l-3 28" stroke="#a85a0a" stroke-width="5" stroke-linecap="round"/>`,
  ),
  // Rainbow present with a gold bow.
  gift: svg(
    `<defs>${gradient('g-box', [[0, '#ff4f8a'], [0.25, '#ffb13d'], [0.5, '#49e07a'], [0.75, '#3ab7ff'], [1, '#a15cff']], 'x1="0" y1="0" x2="1" y2="0"')}${gradient('g-gold', [[0, '#ffe14a'], [1, '#f09612']])}</defs>
    <rect x="12" y="42" width="76" height="52" rx="7" fill="url(#g-box)" stroke="#4a1a78" stroke-width="3.5"/>
    <rect x="7" y="32" width="86" height="19" rx="6" fill="url(#g-box)" stroke="#4a1a78" stroke-width="3.5"/>
    <rect x="42" y="32" width="16" height="62" fill="url(#g-gold)" stroke="#8a4a0a" stroke-width="2.5"/>
    <path d="M50 32C40 8 12 0 10 18c-1 12 22 16 40 14zm0 0C60 8 88 0 90 18c1 12-22 16-40 14z" fill="url(#g-gold)" stroke="#8a2a0a" stroke-width="3.5"/>
    <rect x="42" y="23" width="16" height="13" rx="4" fill="#ffc21a" stroke="#8a2a0a" stroke-width="3"/>`,
  ),
  // Two chasing arrows, violet and white.
  rebirth: svg(
    `<defs>${gradient('r-a', [[0, '#e88bff'], [1, '#8a2be0']])}${gradient('r-b', [[0, '#ffffff'], [1, '#b6c8e8']])}</defs>
    <path d="M18 50A33 33 0 0 1 76 28l8-8 4 34-34-4 9-9A18 18 0 0 0 34 50z" fill="url(#r-a)" stroke="#3c1a78" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M82 50A33 33 0 0 1 24 72l-8 8-4-34 34 4-9 9a18 18 0 0 0 29-9z" fill="url(#r-b)" stroke="#2a3c78" stroke-width="3.5" stroke-linejoin="round"/>`,
  ),
  gear: svg(
    `<defs>${gradient('c-g', [[0, '#ffffff'], [1, '#b9cbe4']])}</defs>
    <path fill="url(#c-g)" stroke="#143a7a" stroke-width="4" stroke-linejoin="round" fill-rule="evenodd" d="M43 6h14l3 11 8 3 10-6 10 10-6 10 3 8 11 3v14l-11 3-3 8 6 10-10 10-10-6-8 3-3 11H43l-3-11-8-3-10 6-10-10 6-10-3-8-11-3V43l11-3 3-8-6-10 10-10 10 6 8-3zM50 34a16 16 0 1 0 .01 0z"/>`,
  ),
  book: svg(
    `<defs>${gradient('b-c', [[0, '#3f7df0'], [1, '#1d4cc0']])}</defs>
    <g transform="rotate(-6 50 50)"><rect x="16" y="6" width="68" height="90" rx="7" fill="url(#b-c)" stroke="#0e2a78" stroke-width="3.5"/>
    <rect x="28" y="16" width="46" height="70" rx="3" fill="none" stroke="#f0c43a" stroke-width="3"/>
    <rect x="35" y="25" width="32" height="21" rx="3" fill="#1a43b5"/><rect x="35" y="67" width="32" height="9" rx="2" fill="#dfe9ff"/></g>`,
  ),
  envelope: svg(
    `<defs>${gradient('e-p', [[0, '#fff0d4'], [1, '#f2cfa0']])}</defs>
    <g transform="rotate(-4 50 50)"><rect x="6" y="18" width="88" height="66" rx="6" fill="url(#e-p)" stroke="#a85a1a" stroke-width="4"/>
    <path d="M8 22l42 34 42-34M8 80l30-30M92 80L62 50" fill="none" stroke="#d8a468" stroke-width="3.5"/></g>`,
  ),
  // The hexagonal premium coin.
  coin: svg(
    `<path d="M50 4l40 23v46L50 96 10 73V27z" fill="currentColor" stroke="rgba(0,0,0,0.55)" stroke-width="6" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="17" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="6"/>`,
  ),
  axe: svg(
    `<rect x="44" y="14" width="10" height="82" rx="3" fill="#b2352c" stroke="#3a0d0a" stroke-width="3"/>
    <path d="M12 8h40v30H22c-6-6-10-16-10-30z" fill="#4c5570" stroke="#141827" stroke-width="3.5"/>`,
  ),
  // The gold sawmill over the Rush Hour burst.
  sawGold: svg(
    `<defs>${gradient('m-g', [[0, '#ffdf6a'], [1, '#d68a12']])}</defs>
    <path d="M2 34h34l6-8h16l6 8h34v10l-8 4v6H86v-6H64l-6 14H42l-6-14H14v6H6v-6l-4-4z" fill="url(#m-g)" stroke="#7a4408" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 26V16h20v10M50 16V8" fill="none" stroke="#b9700e" stroke-width="5"/>
    <circle cx="50" cy="7" r="3.2" fill="#ff3b2a"/>
    <path d="M36 54h28" stroke="#a8620c" stroke-width="3" stroke-dasharray="3 3"/>`,
    '0 0 100 74',
  ),
}
