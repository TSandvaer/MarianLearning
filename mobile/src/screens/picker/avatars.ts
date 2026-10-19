/**
 * The 8 avatars' fixed disc colours (learner profiles § 9, T2): fox
 * orange, lion yellow, frog green, turtle teal, penguin blue, owl purple,
 * cat grey (Dave D7: not pink), bear brown. No red anywhere (never a red
 * X). Soft clay tones, so the clay animal reads on top.
 */
import type { AvatarId } from '@marian/core/learners'

export const AVATAR_COLORS: Readonly<Record<AvatarId, string>> = {
  fox: '#F6A35B',
  lion: '#F7D05E',
  frog: '#8FCB6B',
  turtle: '#5EC2B4',
  penguin: '#6FA8E8',
  owl: '#A98BDB',
  cat: '#A7AEB8',
  bear: '#B88A66',
}
