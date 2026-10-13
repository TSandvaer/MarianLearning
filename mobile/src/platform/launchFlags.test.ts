import type { BuildEnv } from './buildEnv'
import {
  NO_LAUNCH_FLAGS,
  buildEnvSource,
  launchArgumentSource,
  resolveLaunchFlags,
  type LaunchFlagName,
  type LaunchFlagSource,
} from './launchFlags'

function source(values: Partial<Record<LaunchFlagName, string>>) {
  const read: LaunchFlagSource = (name) => values[name]
  return read
}

const ENV: BuildEnv = {
  apiBase: undefined,
  progressApiSecret: undefined,
  debug: undefined,
  seed: undefined,
  qaStep: undefined,
  dayOffset: undefined,
  mute: undefined,
  audioCheck: undefined,
  qaAutoTapMs: undefined,
  qaRoute: undefined,
}

describe('resolveLaunchFlags', () => {
  it('no flags anywhere: debug off', () => {
    expect(resolveLaunchFlags([source({}), source({})])).toEqual(
      NO_LAUNCH_FLAGS,
    )
  })

  it('seed and dayOffset are ignored unless debug is 1 (same gate as ?debug=1)', () => {
    expect(
      resolveLaunchFlags([source({ seed: 'cvc-words', dayOffset: '2' })]),
    ).toEqual(NO_LAUNCH_FLAGS)
    expect(
      resolveLaunchFlags([source({ debug: 'true', seed: 'cvc-words' })]),
    ).toEqual(NO_LAUNCH_FLAGS)
  })

  it('debug 1 enables seed and dayOffset', () => {
    expect(
      resolveLaunchFlags([
        source({ debug: '1', seed: 'add-to-20', dayOffset: '2' }),
      ]),
    ).toEqual({ debug: true, seed: 'add-to-20', qaStep: null, dayOffset: '2' })
  })

  it('per flag, the first source with a value wins', () => {
    const launchArgs = source({ seed: 'sub-to-10' })
    const env = source({ debug: '1', seed: 'cvc-words', dayOffset: '4' })
    expect(resolveLaunchFlags([launchArgs, env])).toEqual({
      debug: true,
      seed: 'sub-to-10',
      qaStep: null,
      dayOffset: '4',
    })
  })

  it('qaStep: the -qaStep launch argument wins over EXPO_PUBLIC_QA_STEP', () => {
    const launchArgs = source({ qaStep: 'mult-6-9' })
    const env = source({ debug: '1', qaStep: 'simple-sentences' })
    expect(resolveLaunchFlags([launchArgs, env])).toEqual({
      debug: true,
      seed: null,
      qaStep: 'mult-6-9',
      dayOffset: null,
    })
    expect(resolveLaunchFlags([source({}), env]).qaStep).toBe(
      'simple-sentences',
    )
  })

  it('release safety: qaStep is ignored unless debug is 1, from either source', () => {
    for (const debug of [undefined, '', '0', 'true', 'yes']) {
      expect(
        resolveLaunchFlags([
          source({ debug, qaStep: 'mult-6-9' }),
          source({ qaStep: 'simple-sentences' }),
        ]),
      ).toEqual(NO_LAUNCH_FLAGS)
    }
    expect(NO_LAUNCH_FLAGS.qaStep).toBeNull()
  })

  it('blank values count as unset', () => {
    expect(
      resolveLaunchFlags([
        source({ debug: '1', seed: '  ' }),
        source({ seed: 'cvc-words' }),
      ]),
    ).toEqual({ debug: true, seed: 'cvc-words', qaStep: null, dayOffset: null })
  })
})

describe('launchArgumentSource (iOS NSUserDefaults via RN Settings)', () => {
  it('reads string and number values', () => {
    const read = launchArgumentSource({
      get: (key) =>
        ({ seed: 'cvc-words', debug: 1, qaStep: 'digraphs-sh' })[key],
    })
    expect(read('seed')).toBe('cvc-words')
    expect(read('debug')).toBe('1')
    expect(read('qaStep')).toBe('digraphs-sh')
    expect(read('dayOffset')).toBeUndefined()
  })

  it('ignores other value types and a throwing reader', () => {
    expect(launchArgumentSource({ get: () => ['x'] })('seed')).toBeUndefined()
    expect(
      launchArgumentSource({
        get: () => {
          throw new Error('no settings module')
        },
      })('seed'),
    ).toBeUndefined()
  })
})

describe('buildEnvSource', () => {
  it('maps each flag to its EXPO_PUBLIC_* value', () => {
    const read = buildEnvSource({
      ...ENV,
      debug: '1',
      seed: 'letter-sounds',
      qaStep: 'sub-to-20',
      dayOffset: '1',
    })
    expect(read('debug')).toBe('1')
    expect(read('seed')).toBe('letter-sounds')
    expect(read('qaStep')).toBe('sub-to-20')
    expect(read('dayOffset')).toBe('1')
  })
})
