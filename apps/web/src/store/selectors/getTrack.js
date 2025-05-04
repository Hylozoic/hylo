import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

const getTrack = ormCreateSelector(
  orm,
  (state, trackId) => trackId,
  ({ Track }, trackId) => {
    const track = Track.withId(trackId)
    if (track) {
      return {
        ...track.ref,
        completionRole: track.completionRole,
        currentAction: track.currentAction(),
        posts: track.posts?.toModelArray() || []
      }
    }
    return null
  }
)

export default getTrack
