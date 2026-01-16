import React, { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Loading from 'components/Loading'
import Widget from 'components/Widget'
import PaywallOfferingsSection from 'routes/GroupDetail/PaywallOfferingsSection'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import fetchGroupForLandingPage from 'store/actions/fetchGroupForLandingPage'
import fetchPosts from 'store/actions/fetchPosts'
import presentGroup from 'store/presenters/presentGroup'
import presentPost from 'store/presenters/presentPost'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { getChildGroups } from 'store/selectors/getGroupRelationships'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { useGetJoinRequests } from 'hooks/useGetJoinRequests'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { getPosts } from 'store/selectors/getPosts'
import { RESP_ADMINISTRATION, RESP_MANAGE_CONTENT } from 'store/constants'

const LandingPage = () => {
  const dispatch = useDispatch()
  const params = useRouteParams()
  const { t } = useTranslation()

  const groupSlug = params.groupSlug
  const fetchPostsParam = useMemo(() => ({ slug: groupSlug, context: 'groups', sortBy: 'created' }), [groupSlug])
  const groupSelector = useSelector(state => getGroupForSlug(state, params.groupSlug))
  const group = useMemo(() => presentGroup(groupSelector), [groupSelector])
  const hasAccess = group?.canAccess !== false // Default to true if not paywalled or if canAccess is undefined
  // const isAboutOpen = !!params.detailGroupSlug
  const canEdit = useSelector(state => hasResponsibilityForGroup(state, { groupId: group.id, responsibility: [RESP_ADMINISTRATION, RESP_MANAGE_CONTENT] }))
  const _posts = useSelector(state => getPosts(state, fetchPostsParam))
  const posts = useMemo(() => _posts.map(p => presentPost(p, group.id)), [_posts, group.id])
  const widgets = ((group && group.widgets) || []).filter(w => w.name !== 'map' && w.context === 'landing')
  const memberships = useSelector(state => getMyMemberships(state))
  const joinRequests = useGetJoinRequests()
  const _childGroups = useSelector(state => getChildGroups(state, group))
  const childGroups = useMemo(() => _childGroups.map(g => ({
    ...g,
    memberStatus: memberships.find(m => m.group.id === g.id) ? 'member' : joinRequests.find(jr => jr.group.id === g.id) ? 'requested' : 'not'
  })), [_childGroups, memberships, joinRequests])

  useEffect(() => {
    dispatch(fetchPosts(fetchPostsParam))
    dispatch(fetchGroupForLandingPage({ slug: groupSlug }))
  }, [fetchPostsParam, groupSlug])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Explore'),
      icon: 'RaisedHand',
      info: ''
    })
  }, [])

  if (!group || widgets.length === 0) return <Loading />

  // Show paywall offerings if group is paywalled and user doesn't have access
  if (group?.paywall && !hasAccess) {
    return (
      <div className='p-4'>
        <PaywallOfferingsSection group={group} />
      </div>
    )
  }

  return (
    <div>
      {widgets && widgets.map(widget => (
        <Widget
          {...widget}
          childGroups={childGroups}
          key={widget.id}
          group={group}
          canEdit={canEdit}
          posts={posts}
        />
      ))}
    </div>
  )
}

export default LandingPage
