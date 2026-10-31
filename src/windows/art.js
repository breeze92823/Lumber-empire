// Inline SVG art for the windows, in the same glossy style as hudIcons.js: bold shapes,
// gradient fills, a dark outline. Ids are prefixed by icon name.
const svg = (body, box = '0 0 100 100') => `<svg viewBox="${box}" aria-hidden="true">${body}</svg>`
const gradient = (id, stops, dir = 'x1="0" y1="0" x2="0" y2="1"') =>
  `<linearGradient id="${id}" ${dir}>${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`

const BOW = `<path d="M50 34C42 10 16 2 12 18c-3 13 20 18 38 16zm0 0c8-24 34-32 38-16 3 13-20 18-38 16z" fill="#ffd21f" stroke="#a8620a" stroke-width="3.5"/>
  <path d="M26 16c4 2 8 7 11 11M74 16c-4 2-8 7-11 11" stroke="#f09a12" stroke-width="3" stroke-linecap="round" fill="none"/>
  <rect x="42" y="25" width="16" height="13" rx="4" fill="#ffe14a" stroke="#a8620a" stroke-width="3"/>`

// A present in one of the three reference colours: [light, dark, outline].
const TONES = {
  pink: ['#ff8fe4', '#e23fc4', '#8f1f86'],
  green: ['#5fe85f', '#17a83a', '#0b6a24'],
  blue: ['#3f9cf5', '#1557d0', '#0c2f8a'],
}
function present(tone, id) {
  const [light, dark, line] = TONES[tone]
  return `<defs>${gradient(id, [[0, light], [1, dark]])}</defs>
    <rect x="14" y="44" width="72" height="50" rx="6" fill="url(#${id})" stroke="${line}" stroke-width="3.5"/>
    <rect x="8" y="33" width="84" height="19" rx="5" fill="url(#${id})" stroke="${line}" stroke-width="3.5"/>
    <rect x="42" y="33" width="16" height="61" fill="#ffd21f" stroke="#a8620a" stroke-width="2.5"/>
    <rect x="14" y="37" width="24" height="4" rx="2" fill="#fff" opacity=".45"/>
    ${BOW}`
}

// The little blocky body shared by the index portraits. Locked entries draw one flat black.
const HATS = {
  hardhat: { d: 'M31 15c0-11 9-14 19-14s19 3 19 14h5v6H26v-6z', color: '#ffc61f' },
  cap: { d: 'M35 6h30v12H35z', color: '#3f4a5e' },
  tall: { d: 'M39 0h22v18H39z', color: '#3f4a5e' },
  horns: { d: 'M34 18L23 0l18 9 9-6 9 6 18-9-11 18z', color: '#7a1a1a' },
  spikes: { d: 'M32 20L27 2l10 7 3-9 10 7 10-7 3 9 10-7-5 18z', color: '#7a1a1a' },
  crown: { d: 'M31 18L27 0l12 8 11-8 11 8 12-8-4 18z', color: '#ffc61f' },
  wide: { d: 'M18 18l14-7 4-11h28l4 11 14 7z', color: '#22332a' },
}
export function figure({ hat, name }) {
  const locked = !name
  const c = (color) => (locked ? '#000' : color)
  return svg(
    `<rect x="30" y="44" width="40" height="38" fill="${c('#e8892b')}"/>
    <rect x="14" y="44" width="16" height="38" fill="${c('#c9a27c')}"/>
    <rect x="70" y="44" width="16" height="38" fill="${c('#c9a27c')}"/>
    <rect x="31" y="82" width="18" height="34" fill="${c('#1f3a8c')}"/>
    <rect x="51" y="82" width="18" height="34" fill="${c('#1f3a8c')}"/>
    <rect x="36" y="16" width="28" height="28" rx="3" fill="${c('#c9a27c')}"/>
    <path d="${HATS[hat].d}" fill="${c(HATS[hat].color)}"/>
    ${locked ? '' : '<rect x="42" y="26" width="4" height="5" fill="#23201c"/><rect x="54" y="26" width="4" height="5" fill="#23201c"/><path d="M44 36h12" stroke="#23201c" stroke-width="2"/>'}`,
    '0 0 100 118',
  )
}

// The worker from the chest up, for round portraits and the reward tile.
const WORKER_BUST = `<rect x="12" y="46" width="19" height="58" fill="#c9a27c"/><rect x="69" y="46" width="19" height="58" fill="#c9a27c"/>
  <rect x="29" y="44" width="42" height="56" fill="#e8892b"/><rect x="40" y="44" width="20" height="6" fill="#c56c18"/>
  <rect x="29" y="88" width="42" height="14" fill="#1f3a8c"/>
  <rect x="36" y="8" width="28" height="36" rx="4" fill="#d8b48c"/><rect x="36" y="8" width="8" height="36" fill="#c9a27c"/>
  <rect x="44" y="20" width="4" height="6" fill="#23201c"/><rect x="56" y="20" width="4" height="6" fill="#23201c"/><path d="M46 33h9" stroke="#23201c" stroke-width="2.4"/>`

export const ART = {
  gift: svg(
    `<defs>${gradient('wg-b', [[0, '#ff9be8'], [1, '#e23fc4']])}</defs>
    <rect x="14" y="44" width="72" height="52" rx="6" fill="url(#wg-b)" stroke="#8f1f86" stroke-width="3.5"/>
    <rect x="8" y="32" width="84" height="20" rx="5" fill="url(#wg-b)" stroke="#8f1f86" stroke-width="3.5"/>
    <rect x="42" y="32" width="16" height="64" fill="#ffd21f" stroke="#a8620a" stroke-width="2.5"/>
    <rect x="14" y="36" width="24" height="5" rx="2.5" fill="#fff" opacity=".5"/>
    ${BOW}`,
  ),
  // Two chasing arrows, pink and blue.
  rebirth: svg(
    `<defs>${gradient('wr-a', [[0, '#ff7ab8'], [1, '#e0246a']])}${gradient('wr-b', [[0, '#7fe0ff'], [1, '#2f7ff0']])}</defs>
    <path d="M12 56C8 24 38 2 68 14l8-11 10 38-40 3 9-13C38 24 26 36 30 56z" fill="url(#wr-a)" stroke="#6a1048" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M88 44c4 32-26 54-56 42l-8 11-10-38 40-3-9 13c17 7 29-5 25-25z" fill="url(#wr-b)" stroke="#123a88" stroke-width="3.5" stroke-linejoin="round"/>`,
  ),
  book: svg(
    `<defs>${gradient('wb-c', [[0, '#6fc4ff'], [1, '#1f7fe0']])}</defs>
    <g transform="rotate(-14 50 50)">
      <path d="M18 14h62a4 4 0 0 1 4 4v66H20a7 7 0 0 1-7-7V20a6 6 0 0 1 5-6z" fill="url(#wb-c)" stroke="#0e3a88" stroke-width="3.5"/>
      <path d="M13 76a7 7 0 0 1 7-7h64v15H20a7 7 0 0 1-7-7z" fill="#f4f0e4" stroke="#0e3a88" stroke-width="3.5"/>
      <g fill="#bfe6ff"><circle cx="30" cy="28" r="4"/><circle cx="44" cy="28" r="4"/><circle cx="58" cy="28" r="4"/><circle cx="72" cy="28" r="4"/><circle cx="30" cy="42" r="4"/><circle cx="44" cy="42" r="4"/><circle cx="58" cy="42" r="4"/><circle cx="72" cy="42" r="4"/><circle cx="30" cy="56" r="4"/><circle cx="44" cy="56" r="4"/><circle cx="58" cy="56" r="4"/><circle cx="72" cy="56" r="4"/></g>
      <path d="M62 66h15v30l-7.500-6-7.500 6z" fill="#e8312e" stroke="#7a1010" stroke-width="3" stroke-linejoin="round"/>
    </g>`,
  ),
  presentPink: svg(present('pink', 'wp-p')),
  presentGreen: svg(present('green', 'wp-g')),
  presentBlue: svg(
    `<defs>${gradient('wp-b', [[0, '#3f9cf5'], [1, '#1557d0']])}</defs>
    <rect x="12" y="34" width="176" height="46" rx="6" fill="url(#wp-b)" stroke="#0c2f8a" stroke-width="3.5"/>
    <rect x="4" y="24" width="192" height="18" rx="5" fill="url(#wp-b)" stroke="#0c2f8a" stroke-width="3.5"/>
    <rect x="90" y="24" width="20" height="56" fill="#ffd21f" stroke="#a8620a" stroke-width="2.5"/>
    <path d="M100 26C92 6 66 0 62 13c-3 11 20 15 38 13zm0 0c8-20 34-26 38-13 3 11-20 15-38 13z" fill="#ffd21f" stroke="#a8620a" stroke-width="3.5"/>
    <rect x="92" y="17" width="16" height="12" rx="4" fill="#ffe14a" stroke="#a8620a" stroke-width="3"/>`,
    '0 0 200 84',
  ),
  cash: svg(
    `<defs>${gradient('wc-a', [[0, '#7cf05a'], [1, '#22a83a']])}</defs>
    <g stroke="#0f5a22" stroke-width="3.5" stroke-linejoin="round">
      <path d="M8 58l58-34 28 20-58 36z" fill="#1c8a34"/>
      <path d="M8 48l58-34 28 20-58 36z" fill="url(#wc-a)"/>
      <path d="M8 38l58-34 28 20-58 36z" fill="url(#wc-a)"/>
    </g>
    <path d="M30 34l22-13 11 8-22 13z" fill="#d8ffb8"/>
    <path d="M36 70v14l58-36V34" fill="#14702a" stroke="#0f5a22" stroke-width="3.5" stroke-linejoin="round"/>`,
  ),
  cashPile: svg(
    `<defs>${gradient('wp-c', [[0, '#7cf05a'], [1, '#249c35']])}</defs>
    <g stroke="#0f5a22" stroke-width="3" stroke-linejoin="round">
      <path d="M4 62l44-22 20 12-44 24z" fill="url(#wp-c)"/>
      <path d="M46 50l44-20 16 12-42 22z" fill="url(#wp-c)"/>
      <path d="M20 44l44-24 20 13-44 24z" fill="url(#wp-c)"/>
      <path d="M34 26L78 2l18 12-44 25z" fill="url(#wp-c)"/>
      <path d="M58 16l10 4 8-12" fill="none" stroke="#f0c43a" stroke-width="8"/>
      <path d="M24 76v6l44-24v-6M64 64v6l42-22v-6" fill="#14702a"/>
    </g>`,
    '0 0 110 86',
  ),
  crate: svg(
    `<defs>${gradient('wk-w', [[0, '#b98a5c'], [1, '#7a5230']])}</defs>
    <path d="M10 20h80v72H10z" fill="url(#wk-w)" stroke="#3a2412" stroke-width="4"/>
    <path d="M10 20l80 72M90 20L10 92" stroke="#5e3c20" stroke-width="9"/>
    <path d="M10 20h80v12H10zM10 80h80v12H10zM10 20h12v72H10zM78 20h12v72H78z" fill="#94683f" stroke="#3a2412" stroke-width="3"/>
    <path d="M30 8l42 6-2 12-42-6z" fill="#3f6fd0" stroke="#163a88" stroke-width="3"/>`,
  ),
  trophy: svg(
    `<defs>${gradient('wt-g', [[0, '#ffd34a'], [1, '#f0861a']])}</defs>
    <path d="M26 16H8c0 22 10 32 24 34M74 16h18c0 22-10 32-24 34" fill="none" stroke="#b5650a" stroke-width="9"/>
    <path d="M26 16H8c0 22 10 32 24 34M74 16h18c0 22-10 32-24 34" fill="none" stroke="#ffc53a" stroke-width="4"/>
    <path d="M22 8h56v26c0 20-12 30-28 30S22 54 22 34z" fill="url(#wt-g)" stroke="#a8560a" stroke-width="3.5"/>
    <path d="M30 14v20c0 10 4 16 10 20" fill="none" stroke="#fff0a0" stroke-width="5" stroke-linecap="round"/>
    <path d="M42 62h16v14H42z" fill="#e8861a" stroke="#a8560a" stroke-width="3.5"/>
    <path d="M26 76h48l5 16H21z" fill="url(#wt-g)" stroke="#a8560a" stroke-width="3.5"/>`,
  ),
  worker: svg(WORKER_BUST),
}
