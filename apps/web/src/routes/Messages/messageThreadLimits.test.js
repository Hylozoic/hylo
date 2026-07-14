import { AXOLOTL_ID } from 'store/models/Person'
import {
  MAX_MESSAGE_THREAD_PARTICIPANTS,
  canAddThreadParticipant,
  countThreadParticipants
} from './messageThreadLimits'

describe('messageThreadLimits', () => {
  const currentUserId = '100'

  it('counts participants excluding the Axolotl', () => {
    const others = Array.from({ length: 19 }, (_, i) => String(i + 1))
    expect(countThreadParticipants([...others, AXOLOTL_ID], currentUserId)).toBe(MAX_MESSAGE_THREAD_PARTICIPANTS)
    expect(countThreadParticipants([...others, AXOLOTL_ID, '999'], currentUserId)).toBe(MAX_MESSAGE_THREAD_PARTICIPANTS + 1)
  })

  it('allows adding participants until the limit is reached', () => {
    const atLimit = Array.from({ length: 19 }, (_, i) => ({ id: String(i + 1) }))
    expect(canAddThreadParticipant(atLimit, currentUserId)).toBe(false)
    expect(canAddThreadParticipant(atLimit.slice(0, 18), currentUserId)).toBe(true)
  })
})
