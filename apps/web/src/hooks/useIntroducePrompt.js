import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { introduceYourselfUrl } from '@hylo/navigation'
import { normalizeAcceptedPostTypes } from 'store/models/Group'
import getMyMemberships from 'store/selectors/getMyMemberships'

/** True when the group takes discussions (no accepted-types list means every type). */
export function groupAcceptsDiscussions (group) {
  if (!group) return false
  const types = normalizeAcceptedPostTypes(group.acceptedPostTypes)
  return types == null || types.includes('discussion')
}

/**
 * Whether to offer "Introduce yourself" in a group, and what it does: open
 * the composer over the current page as a discussion prefilled with the
 * group's introduction template. Offered to the group's members only, and
 * only where the group takes discussions.
 */
export default function useIntroducePrompt (group, { entry } = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const isMember = useSelector(state => !!group?.id &&
    getMyMemberships(state).some(membership => String(membership.group?.id) === String(group.id)))
  const canIntroduce = isMember && groupAcceptsDiscussions(group)
  const openIntroduction = useCallback(() => {
    navigate(introduceYourselfUrl(location, { entry }))
  }, [entry, location, navigate])
  return { canIntroduce, openIntroduction }
}
