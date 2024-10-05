import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { isNull, isUndefined, omitBy } from 'lodash/fp'
import { isContextGroup } from 'store/models/Group'
import getMe from 'store/selectors/getMe'

export default function useFetchPostParam ({
  filter,
  forGroup,
  myHome,
  streamType,
  topicName,
  customView,
  sortBy,
  timeframe
}) {
  const currentUser = useSelector(getMe)
  const [fetchPostParam, setFetchPostParam] = useState()

  useEffect(() => {
    setFetchPostParam(
      omitBy(x => isNull(x) || isUndefined(x), {
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
        first: null,
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
      })
    )
  }, [
    streamType,
    filter,
    customView?.activePostsOnly,
    timeframe,
    myHome,
    currentUser?.settings?.streamChildPosts,
    forGroup.slug,
    customView?.collectionId,
    sortBy,
    topicName,
    currentUser?.id,
    customView?.type
  ])

  return fetchPostParam
}
