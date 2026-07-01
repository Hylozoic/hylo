import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

const getFundingRound = ormCreateSelector(
  orm,
  (state, fundingRoundId) => fundingRoundId,
  ({ FundingRound }, fundingRoundId) => {
    const fundingRound = FundingRound.withId(fundingRoundId)
    if (fundingRound) {
      const users = (fundingRound.users?.toModelArray() || []).map(user => ({
        ...user.ref,
        groupRoles: user.groupRoles
          ? { items: user.groupRoles.items }
          : { items: [] }
      }))

      return {
        ...fundingRound.ref,
        submitterRoles: fundingRound.submitterRoles?.toRefArray() || [],
        voterRoles: fundingRound.voterRoles?.toRefArray() || [],
        submissions: fundingRound.submissions?.toModelArray() || [],
        users,
        allocations: fundingRound.ref.allocations || []
      }
    }
    return null
  }
)

export default getFundingRound
