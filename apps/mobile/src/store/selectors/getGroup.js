import orm from '../models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { get } from 'lodash/fp'
import { ALL_GROUP, ALL_GROUP_ID, MY_CONTEXT_GROUP, MY_CONTEXT_ID, PUBLIC_GROUP, PUBLIC_GROUP_ID } from 'store/models/Group'

const getGroup = ormCreateSelector(
  orm,
  (_, props) => get('id', props),
  (_, props) => get('slug', props),
  (session, id, slug) => {
    if (id === ALL_GROUP_ID || slug === ALL_GROUP_ID) {
      return ALL_GROUP
    }
    if (id === PUBLIC_GROUP_ID || slug === PUBLIC_GROUP_ID) {
      return PUBLIC_GROUP
    }
    if (id === MY_CONTEXT_ID || slug === MY_CONTEXT_ID) {
      return MY_CONTEXT_GROUP
    }

    return session?.Group.safeGet({ id, slug })
  }
)
export default getGroup
