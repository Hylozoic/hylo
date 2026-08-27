import orm from '../models'
import { createSelector as ormCreateSelector } from 'redux-orm'

const getTracksForGroup = ormCreateSelector(
  orm,
  (state, props) => props.groupId,
  (session, groupId) => {
    const group = session.Group.withId(groupId)
    // Deduplicate: redux-orm many() relationships can accumulate duplicate
    // entries when the same data is fetched/extracted more than once.
    const seen = new Set()
    return group.tracks.toModelArray()
      .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
      .sort((a, b) => (a.space?.name || '').localeCompare(b.space?.name || ''))
  }
)

export default getTracksForGroup
