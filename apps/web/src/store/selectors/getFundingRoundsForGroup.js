import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

const getFundingRoundsForGroup = ormCreateSelector(
  orm,
  (state, props) => props.groupId,
  (session, groupId) => {
    const group = session.Group.withId(groupId)
    return group.fundingRounds.toModelArray().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }
)

export default getFundingRoundsForGroup
