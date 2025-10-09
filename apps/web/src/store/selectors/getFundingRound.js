import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

const getFundingRound = ormCreateSelector(
  orm,
  (state, fundingRoundId) => fundingRoundId,
  ({ FundingRound }, fundingRoundId) => {
    const fundingRound = FundingRound.withId(fundingRoundId)
    if (fundingRound) {
      return {
        ...fundingRound.ref,
        submitterRole: fundingRound.submitterRole,
        voterRole: fundingRound.voterRole,
        submissions: fundingRound.submissions?.toModelArray() || []
      }
    }
    return null
  }
)

export default getFundingRound
