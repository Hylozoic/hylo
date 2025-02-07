import orm from 'store/models'
import { createSelector as ormCreateSelector } from 'redux-orm'

const getTopicFollowForCurrentRoute = ormCreateSelector(
  orm,
  (state, groupId, topicName) => groupId,
  (state, groupId, topicName) => topicName,
  (session, groupId, topicName) => {
    const topic = session.Topic.safeGet({ name: topicName })
    if (!topic) return null
    return session.TopicFollow.safeGet({ group: groupId, topic: topic.id })
  }
)

export default getTopicFollowForCurrentRoute
