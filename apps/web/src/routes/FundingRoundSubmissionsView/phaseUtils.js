import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'

/** Safely parses a round date into a DateTime, or null if missing/invalid. */
function toDateTime (value) {
  if (!value) return null
  try {
    // Numeric millisecond timestamps (optimistic updates / legacy payloads)
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
      const date = new Date(Number(value))
      if (Number.isNaN(date.getTime())) return null
      return DateTimeHelpers.toDateTime(date.toISOString(), { locale: getLocaleFromLocalStorage() })
    }
    return DateTimeHelpers.toDateTime(value, { locale: getLocaleFromLocalStorage() })
  } catch (error) {
    return null
  }
}

export function getRoundPhaseMeta (round) {
  const now = new Date()

  const submissionsOpenAt = toDateTime(round?.submissionsOpenAt)
  const submissionsCloseAt = toDateTime(round?.submissionsCloseAt)
  const votingOpensAt = toDateTime(round?.votingOpensAt)
  const votingClosesAt = toDateTime(round?.votingClosesAt)

  if (round?.phase === 'draft' || round?.phase === 'archived') {
    return {
      currentPhase: round.phase === 'archived' ? 'archived' : 'draft',
      submissionsOpenAt,
      submissionsCloseAt,
      votingOpensAt,
      votingClosesAt
    }
  }

  let currentPhase = 'draft'

  if (round?.votingClosesAt && votingClosesAt && votingClosesAt <= now) {
    currentPhase = 'completed'
  } else if (round?.votingOpensAt && votingOpensAt && votingOpensAt <= now) {
    currentPhase = 'voting'
  } else if (round?.submissionsCloseAt && submissionsCloseAt && submissionsCloseAt <= now) {
    currentPhase = 'discussion'
  } else if (round?.submissionsOpenAt && submissionsOpenAt && submissionsOpenAt <= now) {
    currentPhase = 'submissions'
  } else if (round?.phase && round.phase !== 'draft' && round.phase !== 'archived') {
    currentPhase = 'open'
  }

  return {
    currentPhase,
    submissionsOpenAt,
    submissionsCloseAt,
    votingOpensAt,
    votingClosesAt
  }
}
