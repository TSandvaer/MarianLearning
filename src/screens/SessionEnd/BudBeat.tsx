/**
 * Session-end bud beat (Emma's Path 9/10, ClickUp 123jpnbc3dt; spec
 * `design/emmas-path/emmas-path-spec.md` §6 step 2, §7).
 *
 * After the stardust tally, a 72 pt copy of the focus stop slides up with
 * its bud row and the bud(s) this session banked open (scale 0 → 1.15 →
 * 1.0, 450 ms). Buds already open stay open: the row never shrinks.
 * Reduced motion: 200 ms cross-fades instead of the slide and the pop.
 */

import type { ReactElement } from 'react'
import { m } from 'motion/react'
import type { NodeProgress } from '../../lib/progress/nodeProgress'
import type { SkillNode } from '../../lib/progress'
import { StepArt } from '../Hub/HubPathCard'
import { Bud } from '../Map/Bud'
import { BUD_OPEN_DELAY_S, budGroups } from './budGroups'

const ROSE = '#F48FB1'
const STOP_SIZE = 72

export function BudBeat({
  node,
  before,
  after,
  reducedMotion,
}: {
  node: SkillNode
  before: NodeProgress
  after: NodeProgress
  reducedMotion: boolean
}): ReactElement {
  const groups = budGroups(before, after)
  const budSize = groups.length > 1 ? 12 : 16
  return (
    <m.div
      data-testid="session-end-bud-beat"
      data-node={node}
      className="flex flex-col items-center"
      style={{ gap: 8 }}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 48 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={
        reducedMotion
          ? { duration: 0.2 }
          : { type: 'spring', stiffness: 260, damping: 22 }
      }
    >
      <span
        className="flex items-center justify-center rounded-full bg-white"
        style={{
          width: STOP_SIZE,
          height: STOP_SIZE,
          boxShadow: `0 0 0 3px ${ROSE}`,
        }}
      >
        <StepArt node={node} size={56} />
      </span>
      <span
        className="flex items-center justify-center"
        style={{ gap: 12, whiteSpace: 'nowrap' }}
      >
        {groups.map((group, gi) => (
          <span
            key={gi}
            className="flex items-center"
            style={{ gap: groups.length > 1 ? 2 : 6 }}
          >
            {Array.from({ length: group.required }, (_, i) => {
              const open = i < group.now
              const isNew = i >= group.was && i < group.now
              return (
                <m.span
                  key={i}
                  className="inline-flex"
                  data-testid="session-end-bud"
                  data-open={open ? 'true' : 'false'}
                  data-new={isNew ? 'true' : 'false'}
                  initial={
                    isNew
                      ? reducedMotion
                        ? { opacity: 0 }
                        : { scale: 0 }
                      : false
                  }
                  animate={
                    isNew
                      ? reducedMotion
                        ? { opacity: 1 }
                        : { scale: [0, 1.15, 1] }
                      : undefined
                  }
                  transition={{
                    delay: BUD_OPEN_DELAY_S,
                    duration: reducedMotion ? 0.2 : 0.45,
                  }}
                >
                  <Bud
                    open={open}
                    size={budSize}
                    testId="session-end-bud-icon"
                  />
                </m.span>
              )
            })}
          </span>
        ))}
      </span>
    </m.div>
  )
}
