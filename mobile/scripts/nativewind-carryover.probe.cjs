// Usage: node carryover.cjs <mobileDir> <webFile>...
// Compiles every Tailwind class the web files use through NativeWind v4's
// own pipeline (tailwind + nativewind/preset -> react-native-css-interop
// cssToReactNativeRuntime) and classifies each class.
const path = require('path')
const fs = require('fs')
const mobile = path.resolve(process.argv[2])
const files = process.argv.slice(3)
const req = (m) => require(require.resolve(m, { paths: [mobile] }))
const postcss = req('postcss')
const tailwind = req('tailwindcss')
const { cssToReactNativeRuntime } = req(
  'react-native-css-interop/dist/css-to-rn/index.js',
)

const classes = new Set()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const re = /className=(?:"([^"]*)"|\{`([^`]*)`\}|'([^']*)')/g
  let m
  while ((m = re.exec(src))) {
    for (const c of (m[1] ?? m[2] ?? m[3]).split(/\s+/)) if (c) classes.add(c)
  }
}
const list = [...classes].sort()

async function main() {
  const config = {
    content: [{ raw: list.join(' ') }],
    presets: [req('nativewind/preset')],
    theme: {
      extend: {
        colors: {
          'my-pink': '#FFC0CB',
          'my-cream': '#FFF5F0',
          'my-rose': '#F48FB1',
          ink: '#3D2B3D',
        },
        fontFamily: { display: ['ui-rounded', 'system-ui', 'sans-serif'] },
      },
    },
  }
  const out = await postcss([tailwind(config)]).process(
    '@tailwind utilities;',
    { from: undefined },
  )
  const compiled = cssToReactNativeRuntime(out.css, {})
  const rules = compiled.rules ?? {}
  const rows = []
  for (const c of list) {
    // Tailwind escapes selectors; css-interop keys rules by the class name.
    const rule = rules[c]
    const generated = out.css.includes(
      '.' + c.replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\' + ch),
    )
    let verdict
    if (!generated) verdict = 'no-tailwind-rule'
    else if (!rule) verdict = 'dropped'
    else if (rule.warnings?.length) verdict = 'partial'
    else verdict = 'ok'
    const media = rule?.n?.some((s) => s.media?.length) ? ' (media)' : ''
    rows.push({ c, verdict: verdict + media, warn: rule?.warnings })
  }
  const counts = {}
  for (const r of rows) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1
  for (const r of rows)
    console.log(
      `${r.verdict.padEnd(22)} ${r.c}${r.warn ? '  ' + JSON.stringify(r.warn) : ''}`,
    )
  console.log('\nTOTAL', list.length, JSON.stringify(counts))
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
