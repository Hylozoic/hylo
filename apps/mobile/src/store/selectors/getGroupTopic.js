import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

export const getGroupTopic = ormCreateSelector(
  orm,
  (state, props) => props.topicName,
  (state, props) => props.slug,
  (session, topicName, slug) => {
    const topic = session.Topic.safeGet({ name: topicName })
    const group = session?.Group.safeGet({ slug })
    if (!topic || !group) return false

    return session.GroupTopic.filter({
      topic: topic.id, group: group.id
    }).first()
  }
)

export default getGroupTopic
