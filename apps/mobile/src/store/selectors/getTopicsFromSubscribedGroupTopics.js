import { createSelector as ormCreateSelector } from 'redux-orm'
import { sortBy } from 'lodash/fp'
import orm from 'store/models'
import { topicUrl } from 'util/navigation'

const getTopicName = ({ topic: { name } }) => name.toLowerCase()

// Copied from Evo Sep-23 and modified
export const getTopicsFromSubscribedGroupTopics = (state, props) => {
  const { groupSlug, groupId } = props
  if (!groupSlug || !groupId) return []

  const groupTopics = getSubscribedGroupTopics(state, props)

  const topics = groupTopics.map(groupTopic => {
    return {
      ...groupTopic.ref,
      ...groupTopic.topic.ref,
      groupTopicId: groupTopic.id,
      url: topicUrl(groupTopic.topic.name, { groupSlug }),
      isSubscribed: groupTopic.visibility === 2 ? true : groupTopic.isSubscribed,
    }
  })
  return topics
}

// Copied from Evo Sep-23 and modified
export const getSubscribedGroupTopics = ormCreateSelector(
  orm,
  (_, { groupId }) => groupId,
  (session, groupId) => {
    let groupTopics
    if (groupId) {
      groupTopics = session.GroupTopic
        .filter({ group: groupId, visibility: 1, isSubscribed: true })
        .toModelArray()

      const pinnedGroupTopics = session.GroupTopic
        .filter({ group: groupId, visibility: 2 })
        .toModelArray()

      return pinnedGroupTopics.concat(sortBy(getTopicName, groupTopics))
    }
  }
)
