import { useMemo } from 'react'
import { isNull, isUndefined, omitBy } from 'lodash/fp'
import { COMMON_VIEWS } from '@hylo/presenters/ContextWidgetPresenter'
import { isContextGroupSlug } from '@hylo/presenters/GroupPresenter'

export default function useStreamQueryVariables ({
  context,
  currentUser,
  customView,
  filter,
  forGroup,
  myHome,
  sortBy,
  streamType,
  timeframe,
  topicName
}) {
  const filterFromStreamType = COMMON_VIEWS[streamType] ? COMMON_VIEWS[streamType].postTypes[0] : null

  const streamQueryVariables = useMemo(() => omitBy(x => isNull(x) || isUndefined(x), {
    activePostsOnly: customView?.activePostsOnly || null,
    afterTime: streamType === 'event'
      ? (timeframe === 'future' ? new Date().toISOString() : null)
      : null,
    announcementsOnly: (myHome === 'announcements') || null,
    beforeTime: streamType === 'event'
      ? (timeframe === 'past' ? new Date().toISOString() : null)
      : null,
    childPostInclusion: currentUser?.settings?.streamChildPosts || 'yes',
    collectionToFilterOut: null,
    context,
    createdBy: myHome === 'posts'
      ? [currentUser.id]
      : null,
    cursor: null,
    filter: filterFromStreamType ||
      filter ||
      currentUser?.settings?.streamPostType,
    forCollection: customView?.collectionId,
    interactedWithBy: myHome === 'interactions'
      ? [currentUser.id]
      : null,
    mentionsOf: myHome === 'mentions'
      ? [currentUser.id]
      : null,
    order: streamType === 'event'
      ? (timeframe === 'future' ? 'asc' : 'desc')
      : null,
    search: null,
    // We just can't get away from some sort of jank until /all is removed from the whole repo
    slug: myHome === 'stream'
      ? 'all'
      : !isContextGroupSlug(forGroup?.slug)
          ? forGroup?.slug
          : null,
    sortBy,
    topic: topicName,
    topics: (customView?.type === 'stream' && customView?.topics)
      ? customView.topics.map(t => t.id)
      : null,
    types: customView?.type === 'stream'
      ? customView?.postTypes
      : null
  }), [
    context,
    currentUser?.id,
    currentUser?.settings?.streamChildPosts,
    customView,
    customView?.activePostsOnly,
    customView?.collectionId,
    customView?.type,
    filter,
    forGroup,
    forGroup?.slug,
    myHome,
    sortBy,
    streamType,
    timeframe,
    topicName
  ])

  return streamQueryVariables
}
