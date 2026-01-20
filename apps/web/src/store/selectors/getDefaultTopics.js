import orm from 'store/models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { get, isEmpty, includes } from 'lodash/fp'
import { makeGetQueryResults } from 'store/reducers/queryResults'
import { FETCH_DEFAULT_TOPICS } from 'store/constants'
import presentTopic from 'store/presenters/presentTopic'

const getDefaultTopicsResults = makeGetQueryResults(FETCH_DEFAULT_TOPICS)

export const getDefaultTopics = ormCreateSelector(
  orm,
  (state, props) => {
    const groups = props?.groups || []
    const groupIds = groups.length > 0
      ? groups.map(g => g?.id).filter(Boolean)
      : undefined
    const groupSlug = groups.length > 0 ? get('groups[0].slug', props) : undefined

    return getDefaultTopicsResults(state, {
      groupIds,
      groupSlug: groupIds ? undefined : groupSlug,
      sortBy: props?.sortBy || 'name'
    })
  },
  (session, results) => {
    if (isEmpty(results) || isEmpty(results.ids)) return []

    const topics = session.Topic.all()
      .filter(x => includes(x.id, results.ids))
      .orderBy(x => results.ids.indexOf(x.id))
      .toModelArray()

    return topics.map(topic => presentTopic(topic))
  }
)

export default getDefaultTopics
