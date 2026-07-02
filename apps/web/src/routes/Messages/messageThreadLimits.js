import { AXOLOTL_ID } from 'store/models/Person'

export const MAX_MESSAGE_THREAD_PARTICIPANTS = 20

/**
 * Count participants toward the thread limit, excluding the Axolotl system user.
 */
export function countThreadParticipants (participantIds, currentUserId) {
  const ids = [...new Set([currentUserId, ...participantIds].filter(Boolean))]
  return ids.filter(id => id !== AXOLOTL_ID).length
}

/**
 * Whether another person can be added to a new thread compose list.
 */
export function canAddThreadParticipant (selectedPeople, currentUserId) {
  const participantIds = selectedPeople.map(p => p.id)
  return countThreadParticipants(participantIds, currentUserId) < MAX_MESSAGE_THREAD_PARTICIPANTS
}
