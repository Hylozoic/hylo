import { sortBy } from 'lodash/fp'
import { gql, useQuery } from 'urql'
import { topicUrl } from '@hylo/navigation'

const groupTopicsQueryBlock = `
  groupTopics(
    first: $first,
    offset: $offset,
    sortBy: $sortBy,
    order: $order,
    subscribed: $subscribed,
    autocomplete: $autocomplete
  ) {
    hasMore
    total
    items {
      id
      followersTotal
      isDefault
      isSubscribed
      lastReadPostId
      newPostCount
      postsTotal
      visibility
      group {
        id
      }
      topic {
        id
        name
      }
    }
  }
`

const groupTopicForGroupQuery = gql`
  query GroupTopicForGroupQuery (
    $id: ID,
    $first: Int,
    $offset: Int,
    $sortBy: String,
    $order: String,
    $subscribed: Boolean,
    $autocomplete: String
  ) {
    group (id: $id) {
      id
      ${groupTopicsQueryBlock}
    }
  }
`

const groupTopicsQuery = gql`
  query GroupTopicsQuery (
    $first: Int,
    $offset: Int,
    $sortBy: String,
    $order: String,
    $subscribed: Boolean,
    $autocomplete: String
  ) {
    ${groupTopicsQueryBlock}
  }
`

// TODO: URL - what topics are supposed to show up for AllGroups / PublicGroups
export default function useEnsureGroupTopics ({ groupId, groupSlug, first = 100 }) {
  const [{ data, fetching: pending }] = useQuery({
    query: groupId ? groupTopicForGroupQuery : groupTopicsQuery,
    variables: {
      autocomplete: '',
      first,
      id: groupId,
      offset: 0,
      order: 'desc',
      sortBy: 'num_followers',
      subscribed: false
    }
  })

  const allGroupTopics = groupId ? data?.group?.groupTopics?.items : data?.groupTopics?.items

  if (pending || !allGroupTopics) {
    return { topics: [], pending }
  }
  const subscribedGroupTopics = allGroupTopics.filter(groupTopic => (
    groupTopic.group.id === groupId &&
    groupTopic.visibility === 1 &&
    groupTopic.isSubscribed === true
  ))

  const pinnedGroupTopics = allGroupTopics.filter(groupTopic => (
    groupTopic.group.id === groupId &&
    groupTopic.visibility === 2
  ))

  const groupTopics = pinnedGroupTopics.concat(
    sortBy(({ topic: { name } }) => name.toLowerCase(), subscribedGroupTopics)
  )

  const topics = groupTopics.map(groupTopic => {
    return {
      ...groupTopic,
      ...groupTopic.topic,
      groupTopicId: groupTopic.id,
      url: topicUrl(groupTopic.topic.name, { groupSlug }),
      isSubscribed: groupTopic.visibility === 2 ? true : groupTopic.isSubscribed
    }
  })

  return { topics, pending }
}
