/**
 * The web's vector assets that Greet renders natively through
 * react-native-svg (`SvgXml`): the file contents minus the XML
 * declaration and comments. `vectors.test.ts` fails when a web file
 * drifts from its copy here.
 */

/** Web file per constant (under `public/assets/`). */
export const VECTOR_SOURCES = {
  BG_CLOUDS_XML: 'bg-clouds.svg',
  HEART_BUTTON_XML: 'heart-button.svg',
  FINGER_TAP_XML: 'icon-finger-tap.svg',
} as const

export const BG_CLOUDS_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 1024" preserveAspectRatio="xMidYMid slice"
     role="img" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#FFF5F0"/>
      <stop offset="60%" stop-color="#FFE7EE"/>
      <stop offset="100%" stop-color="#FFC0CB" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="22%" r="55%">
      <stop offset="0%"  stop-color="#FFFFFF" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <symbol id="cloud" viewBox="0 0 240 100" overflow="visible">
      <g fill="#FFFFFF">
        <ellipse cx="60"  cy="60" rx="56" ry="34"/>
        <ellipse cx="115" cy="46" rx="62" ry="40"/>
        <ellipse cx="170" cy="58" rx="54" ry="32"/>
        <ellipse cx="200" cy="68" rx="36" ry="22"/>
      </g>
      <ellipse cx="120" cy="84" rx="100" ry="6" fill="#F48FB1" opacity="0.08"/>
    </symbol>
  </defs>
  <rect width="768" height="1024" fill="url(#sky)"/>
  <rect width="768" height="1024" fill="url(#glow)"/>
  <use href="#cloud" x="-40"  y="120" width="320" height="134"/>
  <use href="#cloud" x="460"  y="80"  width="260" height="108"/>
  <use href="#cloud" x="220"  y="260" width="200" height="84" opacity="0.85"/>
</svg>`

export const HEART_BUTTON_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" role="img" aria-label="Heart">
  <title>Heart</title>
  <defs>
    <linearGradient id="heartFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#FFB6C5"/>
      <stop offset="100%" stop-color="#F48FB1"/>
    </linearGradient>
    <radialGradient id="shine" cx="38%" cy="32%" r="22%">
      <stop offset="0%"  stop-color="#FFFFFF" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="
    M 60 92
    C 30 74, 8 56, 8 34
    C 8 18, 22 8, 36 8
    C 48 8, 58 16, 60 24
    C 62 16, 72 8, 84 8
    C 98 8, 112 18, 112 34
    C 112 56, 90 74, 60 92 Z"
    fill="#3D2B3D" opacity="0.10" transform="translate(0 4)"/>
  <path d="
    M 60 88
    C 30 70, 8 52, 8 30
    C 8 14, 22 4, 36 4
    C 48 4, 58 12, 60 20
    C 62 12, 72 4, 84 4
    C 98 4, 112 14, 112 30
    C 112 52, 90 70, 60 88 Z"
    fill="url(#heartFill)" stroke="#E07AA0" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="42" cy="26" rx="14" ry="8" fill="url(#shine)"/>
</svg>`

export const FINGER_TAP_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Tap here">
  <title>Tap here</title>
  <circle cx="32" cy="50" r="6" fill="#F48FB1" opacity="0.35"/>
  <circle cx="32" cy="50" r="3" fill="#F48FB1" opacity="0.55"/>
  <path d="
    M 32 44
    C 28.5 44, 27 41, 27 37
    L 27 24
    C 27 20.5, 29 18, 32 18
    C 35 18, 37 20.5, 37 24
    L 37 33
    C 39 32, 42 33, 43 36
    L 44.5 41
    C 46 45, 46 49, 44 52
    C 42 55, 38 56, 34 56
    L 28 56
    C 23 56, 20 53, 20 48
    L 20 41
    C 20 37, 22 35, 25 35
    C 26.5 35, 27 36, 27 37 Z"
    fill="#F48FB1"
    stroke="#3D2B3D"
    stroke-width="2"
    stroke-linejoin="round"
    stroke-linecap="round"/>
  <ellipse cx="30" cy="24" rx="2.2" ry="3.2" fill="#FFC0CB" opacity="0.6"/>
  <path d="
    M 24 55
    C 24 58, 27 59, 32 59
    C 37 59, 40 58, 40 55 Z"
    fill="#F48FB1"/>
</svg>`
