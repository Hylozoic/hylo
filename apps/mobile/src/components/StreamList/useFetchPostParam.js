import { useMemo } from 'react'
import { isNull, isUndefined, omitBy } from 'lodash/fp'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { isContextGroup } from '@hylo/presenters/GroupPresenter'

export default function useFetchPostParam ({
  customView,
  filter,
  forGroup,
  myHome,
  sortBy,
  streamType,
  timeframe,
  topicName
}) {
  const [{ currentUser }] = useCurrentUser()
  const fetchPostParam = useMemo(() => omitBy(x => isNull(x) || isUndefined(x), {
    activePostsOnly: customView?.activePostsOnly || null,
    afterTime: streamType === 'event'
      ? (timeframe === 'future' ? new Date().toISOString() : null)
      : null,
    announcementsOnly: (myHome === 'Announcements') || null,
    beforeTime: streamType === 'event'
      ? (timeframe === 'past' ? new Date().toISOString() : null)
      : null,
    childPostInclusion: currentUser?.settings?.streamChildPosts || 'yes',
    collectionToFilterOut: null,
    context: isContextGroup(forGroup.slug)
      ? forGroup.slug
      : myHome
        ? 'my'
        : 'groups',
    createdBy: myHome === 'My Posts'
      ? [currentUser.id]
      : null,
    cursor: null,
    filter: streamType ||
      filter ||
      currentUser?.settings?.streamPostType ||
      undefined,
    forCollection: customView?.collectionId,
    interactedWithBy: myHome === 'Interactions'
      ? [currentUser.id]
      : null,
    mentionsOf: myHome === 'Mentions'
      ? [currentUser.id]
      : null,
    myHome,
    order: streamType === 'event'
      ? (timeframe === 'future' ? 'asc' : 'desc')
      : null,
    search: null,
    slug: myHome
      ? null
      : forGroup?.slug,
    sortBy,
    topic: topicName,
    topics: customView?.type === 'stream' && customView?.topics
      ? customView.topics.toModelArray().map(t => t.id)
      : null,
    types: customView?.type === 'stream'
      ? customView?.postTypes
      : null
  }), [

    customView,
    customView?.activePostsOnly,
    customView?.collectionId,
    customView?.type,
    filter,
    forGroup,
    forGroup.slug,
    myHome,
    sortBy,
    streamType,
    timeframe,
    topicName,
    currentUser?.settings?.streamChildPosts,
    currentUser?.id
  ])

  return fetchPostParam
}
