import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'

export function getRoundPhaseMeta (round) {
  const now = new Date()
  const toDateTime = (value) => value ? DateTimeHelpers.toDateTime(value, { locale: getLocaleFromLocalStorage() }) : null

  const submissionsOpenAt = toDateTime(round?.submissionsOpenAt)
  const submissionsCloseAt = toDateTime(round?.submissionsCloseAt)
  const votingOpensAt = toDateTime(round?.votingOpensAt)
  const votingClosesAt = toDateTime(round?.votingClosesAt)

  let currentPhase = 'draft'

  if (round?.votingClosesAt && votingClosesAt && votingClosesAt <= now) {
    currentPhase = 'completed'
  } else if (round?.votingOpensAt && votingOpensAt && votingOpensAt <= now) {
    currentPhase = 'voting'
  } else if (round?.submissionsCloseAt && submissionsCloseAt && submissionsCloseAt <= now) {
    currentPhase = 'discussion'
  } else if (round?.submissionsOpenAt && submissionsOpenAt && submissionsOpenAt <= now) {
    currentPhase = 'submissions'
  } else if (round?.publishedAt && round.publishedAt <= now) {
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

