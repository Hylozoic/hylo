import orm from 'store/models'
import { createSelector as ormCreateSelector } from 'redux-orm'

const getGroupTopicForCurrentRoute = ormCreateSelector(
  orm,
  (state, slug, topicName) => slug,
  (state, slug, topicName) => topicName,
  (session, slug, topicName) => {
    const group = session.Group.get({ slug })
    const topic = session.Topic.get({ name: topicName })
    if (!group || !topic) return null
    return topic.groupTopics.filter({ group: group.id }).first()
  }
)

export default getGroupTopicForCurrentRoute
