import { useMemo } from 'react'
import { isNull, isUndefined, omitBy } from 'lodash/fp'
import { COMMON_VIEWS } from '@hylo/presenters/ContextWidgetPresenter'

export default function useStreamQueryVariables ({
  context,
  currentUser,
  customView,
  filter,
  slug,
  view,
  sortBy,
  streamType,
  timeframe,
  topic
}) {
  const filterFromStreamType = COMMON_VIEWS[streamType] ? COMMON_VIEWS[streamType].postTypes[0] : null

  const streamQueryVariables = useMemo(() => omitBy(x => isNull(x) || isUndefined(x), {
    activePostsOnly: customView?.activePostsOnly || null,
    afterTime: streamType === 'event'
      ? (timeframe === 'future' ? new Date().toISOString() : null)
      : null,
    announcementsOnly: (view === 'announcements') || null,
    beforeTime: streamType === 'event'
      ? (timeframe === 'past' ? new Date().toISOString() : null)
      : null,
    childPostInclusion: currentUser?.settings?.streamChildPosts || 'yes',
    context,
    createdBy: view === 'posts'
      ? [currentUser.id]
      : null,
    filter: filterFromStreamType || filter || null,
    forCollection: customView?.collectionId,
    interactedWithBy: view === 'interactions'
      ? [currentUser.id]
      : null,
    mentionsOf: view === 'mentions'
      ? [currentUser.id]
      : null,
    order: streamType === 'event'
      ? (timeframe === 'future' ? 'asc' : 'desc')
      : null,
    slug,
    sortBy,
    topic,
    topics: (customView?.type === 'stream' && customView?.topics)
      ? customView.topics.map(t => t.id)
      : null,
    types: customView?.type === 'stream'
      ? customView?.postTypes
      : null,

    // Unused or not implemented

    collectionToFilterOut: null,
    cursor: null,
    search: null
  }), [
    context,
    currentUser?.id,
    currentUser?.settings?.streamChildPosts,
    customView,
    customView?.activePostsOnly,
    customView?.collectionId,
    customView?.type,
    filter,
    view,
    slug,
    sortBy,
    streamType,
    timeframe,
    topic
  ])

  return streamQueryVariables
}
