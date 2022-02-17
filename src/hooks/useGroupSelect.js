import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import selectGroupByIdAction from 'store/actions/selectGroup'
import { useRoute } from '@react-navigation/core'
import getGroupFromParamsOrCurrent from 'store/selectors/getGroupFromParamsOrCurrent'
import { isContextGroup } from 'store/models/Group'

// NOTE: This forces selection of the group provided in a deeplink to the group feed
// Generalize skipping this if in any modal?
export default function useGroupSelect () {
  const dispatch = useDispatch()
  const route = useRoute()
  const routeParams = route.params
  const groupIdFromParamsOrCurrent = useSelector(state => getGroupFromParamsOrCurrent(state, routeParams))?.id
  const groupIdToSelect = isContextGroup(routeParams?.groupSlug)
    ? routeParams?.groupSlug
    : groupIdFromParamsOrCurrent
  const selectGroupById = groupId => dispatch(selectGroupByIdAction(groupId))

  useEffect(() => {
    selectGroupById(groupIdToSelect)
  }, [groupIdToSelect, dispatch])
}
