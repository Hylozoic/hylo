import { useSelector } from 'react-redux'
import getCurrentGroupSlug from 'store/selectors/getCurrentGroupSlug'
import getGroup from 'store/selectors/getGroup'

// DEPRECATED: Group selection should happen exclusively in `AuthRootNavigator`

export default function getGroupFromParamsOrCurrent (state, params) {
  const groupSlug = params?.groupSlug
  const groupIdFromRoute = params?.groupId
  const currentGroupSlug = useSelector(getCurrentGroupSlug)
  const getGroupParams = groupIdFromRoute
    ? { id: groupIdFromRoute }
    : { slug: groupSlug || currentGroupSlug }

  return getGroup(state, getGroupParams)
}
