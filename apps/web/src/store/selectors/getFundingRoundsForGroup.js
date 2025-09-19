import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

export default function getFundingRoundsForGroup (state, { groupId }) {
  const selector = ormCreateSelector(orm, ({ Group }) => {
    const group = Group.withId(groupId)
    if (!group) return []
    return group.fundingRounds.toRefArray()
  })
  return selector(state)
}
