/**
 * Release safety of the store build (`eas build --profile production`,
 * the TestFlight / App Store binary Marian installs).
 *
 * The code gates every QA surface (seeds, `qaStep`, the step picker,
 * autotap, `qaRoute`, day offset) on the debug flag
 * (`src/platform/launchFlags.test.ts`, `src/platform/native.test.ts`,
 * `QaStepPicker.test.tsx`). These pins keep the store profile from
 * turning the flag on: the only build-time env it sets is the API base,
 * it is a Release store build (not a dev client), and nothing secret or
 * personal is committed (the repo is public; the progress secret is an
 * EAS environment variable, see `docs/testflight.md`).
 */
import { readFileSync } from 'fs'
import { join } from 'path'

interface BuildProfile {
  extends?: string
  developmentClient?: boolean
  distribution?: string
  environment?: string
  autoIncrement?: boolean | string
  env?: Record<string, string>
  ios?: { buildConfiguration?: string; simulator?: boolean; image?: string }
}

interface EasJson {
  cli?: { appVersionSource?: string }
  build: Record<string, BuildProfile>
  submit?: Record<string, { ios?: Record<string, string> }>
}

interface AppJson {
  expo: {
    ios?: {
      config?: { usesNonExemptEncryption?: boolean }
      infoPlist?: Record<string, unknown>
    }
  }
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(__dirname, '..', file), 'utf8')) as T
}

const eas = readJson<EasJson>('eas.json')
const production = eas.build.production

describe('eas.json production profile', () => {
  it('exists, and is a store build on the production EAS environment', () => {
    expect(production).toBeDefined()
    expect(production.distribution).toBe('store')
    expect(production.environment).toBe('production')
  })

  it('is a Release build, not a development client', () => {
    expect(production.extends).toBeUndefined()
    expect(production.developmentClient).toBeUndefined()
    expect(production.ios?.buildConfiguration).toBeUndefined()
    expect(production.ios?.simulator).toBeUndefined()
  })

  it('sets only the API base: no debug, seed, QA, day-offset or mute flag', () => {
    expect(production.env).toEqual({
      EXPO_PUBLIC_API_BASE: 'https://marian-learning.vercel.app',
    })
  })

  it('build numbers come from EAS (remote), bumped on every store build', () => {
    expect(eas.cli?.appVersionSource).toBe('remote')
    expect(production.autoIncrement).toBe(true)
  })

  it('submit.production.ios carries only the App Store Connect app ID (no Apple ID email)', () => {
    expect(Object.keys(eas.submit?.production?.ios ?? {})).toEqual(['ascAppId'])
  })

  it('no profile commits the progress secret', () => {
    for (const profile of Object.values(eas.build)) {
      expect(profile.env ?? {}).not.toHaveProperty(
        'EXPO_PUBLIC_PROGRESS_API_SECRET',
      )
    }
  })
})

describe('app.json store settings', () => {
  const ios = readJson<AppJson>('app.json').expo.ios

  it('declares no non-exempt encryption (skips the export-compliance prompt)', () => {
    expect(ios?.config?.usesNonExemptEncryption).toBe(false)
  })

  it('adds no hand-written usage-description strings (no camera, mic or photos)', () => {
    const keys = Object.keys(ios?.infoPlist ?? {})
    expect(keys.filter((key) => key.endsWith('UsageDescription'))).toEqual([])
  })
})
