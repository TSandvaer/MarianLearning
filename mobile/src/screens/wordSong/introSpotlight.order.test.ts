/**
 * A step's intro lead plays over P1's card (`WordSong.tsx` passes
 * `problem.target.word`), and P1 now changes each session (core
 * `wordOrder.ts`, Dave 2026-10-25). Kevin's review of #700: cake words'
 * "It makes the A say its name" lit the i of kite, the o of bone and the u
 * of tube in 8 of 12 sessions.
 *
 * Over 20 consecutive ordered sessions of each word step with a lead, the
 * cells the cue lights on P1 are the ones the line is about. The patterns
 * are written out from the content waves here, not read from the module
 * under test. No audio, no network.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sessionIntroLine } from '@marian/core/emmasPath/guidanceLines'
import type { SkillNode } from '@marian/core/progress'
import { servedCanon } from '@marian/core/wire/canonPool'
import { wordSongSessionPlanFromServer } from '@marian/core/wordSong/planFromServer'
import {
  orderWordSession,
  WORD_ORDER_STEPS,
  type LastWordOrder,
} from '@marian/core/wordSong/wordOrder'
import type { IntroGuideLineId } from '../../audio'
import { introEndPulse, introSpotlight, introTickCue } from './introSpotlight'

const SESSIONS = 20

/** P1's word in each of 20 consecutive sessions of `step`, from her first. */
function sessionP1s(step: SkillNode): string[] {
  const doc = JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        '../../../../public/canon/word-song/level-1',
        `${step}.json`,
      ),
      'utf8',
    ),
  )
  const plan = servedCanon(doc).plan
  let last: LastWordOrder = null
  const p1s: string[] = []
  for (let s = 1; s <= SESSIONS; s++) {
    const ordered = orderWordSession(plan, step, { seed: 40 + s, last })
    const words = wordSongSessionPlanFromServer(ordered, {
      littleStories: true,
      blendReads: true,
      step,
    }).problems.map((p) => p.target.word)
    p1s.push(words[0]!)
    last = words
  }
  return p1s
}

/** The letters of `word` in the cells `cells` lights, in order. */
const litLetters = (word: string, cells: readonly (number | null)[] | null) =>
  (cells ?? []).map((d, i) => (d === null ? '' : word[i])).join('')

const intro = (step: SkillNode) => `guide.session.intro.${step}` as const

/** Each lead's check on P1's word: the problem, or null when it fits. */
const TEAM = (step: SkillNode, teams: readonly string[]) => (word: string) => {
  const lit = litLetters(word, introSpotlight(intro(step), word, false))
  return teams.includes(lit)
    ? null
    : `lights "${lit}", not ${teams.join(' / ')}`
}

const CHECKS: Readonly<Record<string, (word: string) => string | null>> = {
  // "Two letters, one sound!" (content wave 1 § 3.3): the c k / n g ending.
  'duck-words': (word) => {
    const lit = litLetters(
      word,
      introSpotlight(intro('duck-words'), word, false),
    )
    return ['ck', 'ng'].includes(lit) ? null : `lights "${lit}", not ck / ng`
  },
  // The same line on a team (content wave 4 § 3.3, § 4.3; wave 5 § 4.3, § 5.3).
  'bee-words': TEAM('bee-words', ['ee', 'ea']),
  'car-words': TEAM('car-words', ['ar']),
  'snail-words': TEAM('snail-words', ['ai', 'ay', 'oa']),
  'moon-words': TEAM('moon-words', ['oo']),
  // "Read to the end!" (content wave 2 § 3.3): the end pulse is on the end
  // blend, two consonants.
  'tent-words': (word) => {
    const pulse = introEndPulse(intro('tent-words'), word, false)
    const lit = litLetters(word, pulse)
    const cells = (pulse ?? []).flatMap((d, i) => (d === null ? [] : [i]))
    const lastTwo = cells.join() === `${word.length - 2},${word.length - 1}`
    return lastTwo && /^[^aeiou]{2}$/.test(lit)
      ? null
      : `end pulse on "${lit}", not the end blend`
  },
  // "The E is quiet. It makes the A say its name." (content wave 2 § 4.3):
  // "quiet" dims an e, "A" lights an a.
  'cake-words': (word) => {
    const line = intro('cake-words')
    const text = sessionIntroLine('cake-words')!.text
    const said: string[] = []
    text.split(/\s+/).forEach((_, tick) => {
      const cue = introTickCue(line, text, word, tick)
      if (cue === null) return
      said.push(
        'quiet' in cue
          ? `quiet ${word[cue.quiet]}`
          : `light ${word[cue.light]}`,
      )
    })
    return said.join(', ') === 'quiet e, light a' ? null : said.join(', ')
  },
  // Leads that name no letter: every cell lights, or none.
  'crab-words': (word) => allOrNone(intro('crab-words'), word),
  'sounding-out': (word) => allOrNone(intro('sounding-out'), word),
  'blending-cv': (word) => allOrNone(intro('blending-cv'), word),
}

function allOrNone(line: IntroGuideLineId, word: string): string | null {
  const cells = introSpotlight(line, word, false)
  if (cells === null || cells.every((d) => d !== null)) return null
  return `lights "${litLetters(word, cells)}" only`
}

describe('the intro lead over an ordered session’s P1', () => {
  it('covers every ordered word step with a lead', () => {
    const withLead = [...WORD_ORDER_STEPS].filter(
      (s) => sessionIntroLine(s) !== undefined,
    )
    expect(withLead.sort()).toEqual(Object.keys(CHECKS).sort())
  })

  it.each(Object.keys(CHECKS))('%s: 20 sessions', (step) => {
    const p1s = sessionP1s(step as SkillNode)
    const misses = p1s.flatMap((word, i) => {
      const problem = CHECKS[step]!(word)
      return problem === null ? [] : [`session ${i + 1} ${word}: ${problem}`]
    })
    expect(misses).toEqual([])
  })
})
