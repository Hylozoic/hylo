import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

export default function getFundingRound (state, id) {
  const selector = ormCreateSelector(orm, ({ FundingRound }) => {
    const fr = FundingRound.withId(id)
    return fr ? fr.ref : null
  })
  return selector(state)
}
