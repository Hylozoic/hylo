import React from 'react'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import Stream from 'routes/Stream'
import LandingPage from 'routes/LandingPage'
import useRouteParams from 'hooks/useRouteParams'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { GROUP_TYPES } from 'store/models/Group'
import { groupHomeUrl } from 'util/navigation'

export default function GroupHomeRoute () {
  const routeParams = useRouteParams()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))

  if (currentGroup?.contextWidgets?.items?.length > 0) {
    return <Navigate to={groupHomeUrl({ routeParams, group: currentGroup })} replace />
  } else {
    if (!currentGroup) return <Stream context='groups' />

    switch (currentGroup.type) {
      case GROUP_TYPES.farm:
        return <LandingPage />
      default:
        return <Stream context='groups' />
    }
  }
}
