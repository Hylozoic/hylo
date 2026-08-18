import { Info } from 'lucide-react'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'

import GroupAboutView from 'components/GroupAboutView'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import useRouteParams from 'hooks/useRouteParams'
import { groupUrl, spaceUrl } from '@hylo/navigation'
import fetchGroupDetails from 'store/actions/fetchGroupDetails'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

/** Tab id from /about/<tab> so about/moderation, about/members, about/related-groups land correctly. */
function tabFromPath (pathname) {
  const path = pathname.replace(/\/$/, '')
  if (path.endsWith('/moderation')) return 'moderation'
  if (path.endsWith('/members')) return 'members'
  if (path.endsWith('/related-groups')) return 'related-groups'
  if (path.endsWith('/notifications')) return 'notifications'
  if (path.endsWith('/settings')) return 'settings'
  return 'about'
}

/** Path under the group or space for an About tab. */
function aboutTabPath (tabId) {
  return tabId === 'about' ? 'about' : `about/${tabId}`
}

/** Full-page About for the current group or space: banner, then the tabbed sections. */
export default function GroupAboutPage () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { groupSlug: parentSlug, spaceSlug } = useRouteParams()
  const groupSlug = useEffectiveGroupSlug()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const parentGroup = useSelector(state => spaceSlug ? getGroupForSlug(state, parentSlug) : null)
  const isSpace = Boolean(spaceSlug)
  const tab = useMemo(() => tabFromPath(location.pathname), [location.pathname])

  const handleTabChange = useCallback((tabId) => {
    const path = aboutTabPath(tabId)
    const to = spaceSlug
      ? spaceUrl(parentSlug, spaceSlug, path)
      : groupUrl(parentSlug, path)
    navigate({ pathname: to, search: location.search })
  }, [navigate, parentSlug, spaceSlug, location.search])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({ title: t('About'), icon: <Info />, search: false })
  }, [setHeaderDetails, t])

  useEffect(() => {
    if (!groupSlug) return
    dispatch(fetchGroupDetails({ slug: groupSlug, withContextWidgets: false, withWidgets: false, withPrerequisites: false }))
  }, [dispatch, groupSlug])

  if (!group) return <Loading />

  return (
    <div className='h-full overflow-y-auto'>
      <GroupAboutView
        group={group}
        parentGroup={parentGroup}
        isSpace={isSpace}
        tab={tab}
        onTabChange={handleTabChange}
      />
    </div>
  )
}
