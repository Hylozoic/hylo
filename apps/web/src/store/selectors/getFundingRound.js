import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

const getFundingRound = ormCreateSelector(
  orm,
  (state, fundingRoundId) => fundingRoundId,
  ({ FundingRound, CommonRole, GroupRole }, fundingRoundId) => {
    const fundingRound = FundingRound.withId(fundingRoundId)
    if (fundingRound) {
      // Add type field to roles based on whether they're CommonRole or GroupRole
      const addRoleType = (role) => {
        const isCommon = CommonRole.idExists(role.id)
        return {
          ...role,
          type: isCommon ? 'common' : 'group'
        }
      }

      // Map users to include their relationships (membershipCommonRoles and groupRoles)
      const users = (fundingRound.users?.toModelArray() || []).map(user => ({
        ...user.ref,
        membershipCommonRoles: user.membershipCommonRoles
          ? {
              items: user.membershipCommonRoles.toRefArray()
            }
          : { items: [] },
        groupRoles: user.groupRoles
          ? {
              items: user.groupRoles.items
            }
          : { items: [] }
      }))

      return {
        ...fundingRound.ref,
        submitterRoles: (fundingRound.submitterRoles?.toRefArray() || []).map(addRoleType),
        voterRoles: (fundingRound.voterRoles?.toRefArray() || []).map(addRoleType),
        submissions: fundingRound.submissions?.toModelArray() || [],
        users,
        allocations: fundingRound.ref.allocations || []
      }
    }
    return null
  }
)

export default getFundingRound
