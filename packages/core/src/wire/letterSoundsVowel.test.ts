/**
 * `deriveCurrentTargetVowel` moved from `api/_planner.ts` into core
 * (no-Claude plan phase 4) with no behaviour change. `EXPECTED` is the
 * server function's answer for every one of the 81 vowel-state maps,
 * recorded from `api/_planner.ts` before the move (map key: the first
 * letter of the /o/, /u/, /i/, /e/ states in ladder order).
 */
import { describe, expect, it } from 'vitest'
import {
  LETTER_SOUNDS_VOWEL_LADDER,
  deriveCurrentTargetVowel,
  type VowelSubMasteryState,
} from './letterSoundsVowel.js'

const EXPECTED =
  'iiii:/o/ iiip:null iiim:/o/ iipi:/i/ iipp:/i/ iipm:/i/ iimi:/o/ iimp:/e/ ' +
  'iimm:/o/ ipii:/u/ ipip:/u/ ipim:/u/ ippi:/u/ ippp:/u/ ippm:/u/ ipmi:/u/ ' +
  'ipmp:/u/ ipmm:/u/ imii:/o/ imip:/u/ imim:/o/ impi:/i/ impp:/i/ impm:/i/ ' +
  'immi:/o/ immp:/e/ immm:/o/ piii:/o/ piip:/o/ piim:/o/ pipi:/o/ pipp:/o/ ' +
  'pipm:/o/ pimi:/o/ pimp:/o/ pimm:/o/ ppii:/o/ ppip:/o/ ppim:/o/ pppi:/o/ ' +
  'pppp:/o/ pppm:/o/ ppmi:/o/ ppmp:/o/ ppmm:/o/ pmii:/o/ pmip:/o/ pmim:/o/ ' +
  'pmpi:/o/ pmpp:/o/ pmpm:/o/ pmmi:/o/ pmmp:/o/ pmmm:/o/ miii:/u/ miip:/o/ ' +
  'miim:/u/ mipi:/i/ mipp:/i/ mipm:/i/ mimi:/u/ mimp:/e/ mimm:/u/ mpii:/u/ ' +
  'mpip:/u/ mpim:/u/ mppi:/u/ mppp:/u/ mppm:/u/ mpmi:/u/ mpmp:/u/ mpmm:/u/ ' +
  'mmii:/i/ mmip:/o/ mmim:/i/ mmpi:/i/ mmpp:/i/ mmpm:/i/ mmmi:/e/ mmmp:/e/ ' +
  'mmmm:null'

const STATES: readonly VowelSubMasteryState[] = [
  'intro',
  'practicing',
  'mastered',
]

describe('deriveCurrentTargetVowel', () => {
  it('walks the ladder /o/ → /u/ → /i/ → /e/', () => {
    expect(LETTER_SOUNDS_VOWEL_LADDER).toEqual(['/o/', '/u/', '/i/', '/e/'])
  })

  it("answers every map exactly as the server's function did", () => {
    const got: string[] = []
    for (const o of STATES)
      for (const u of STATES)
        for (const i of STATES)
          for (const e of STATES) {
            const v = deriveCurrentTargetVowel({
              '/o/': o,
              '/u/': u,
              '/i/': i,
              '/e/': e,
            })
            got.push(`${o[0]}${u[0]}${i[0]}${e[0]}:${v ?? 'null'}`)
          }
    expect(got).toHaveLength(81)
    expect(got.join(' ')).toBe(EXPECTED)
  })
})
