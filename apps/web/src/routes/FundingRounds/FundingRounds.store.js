import { CREATE_POST } from 'store/constants'
import { JOIN_FUNDING_ROUND_PENDING, LEAVE_FUNDING_ROUND_PENDING, UPDATE_FUNDING_ROUND_PENDING } from 'store/actions/fundingRoundActions'

export function ormSessionReducer (
  { Post, FundingRound, Role, session },
  { type, meta, payload }
) {
  switch (type) {
    case CREATE_POST: {
      if (!meta.fundingRoundId || !payload.data.createPost) return
      const round = FundingRound.safeGet({ id: meta.fundingRoundId })
      if (!round) return
      round.update({
        numSubmissions: round.numSubmissions + 1
      })
      round.updateAppending({
        submissions: [payload.data.createPost.id]
      })
      return round
    }

    case JOIN_FUNDING_ROUND_PENDING: {
      const round = FundingRound.safeGet({ id: meta.id })
      if (!round) return
      return round.update({ isParticipating: true })
    }

    case LEAVE_FUNDING_ROUND_PENDING: {
      const round = FundingRound.safeGet({ id: meta.id })
      if (!round) return
      return round.update({ isParticipating: false })
    }

    case UPDATE_FUNDING_ROUND_PENDING: {
      const round = FundingRound.safeGet({ id: meta.id })
      if (!round) return
      const data = meta.data
      if (data.submitterRole) {
        let role = Role.withId(meta.data.submitterRole?.id)
        if (!role) {
          role = Role.create(meta.data.submitterRole)
        }
        data.submitterRole = role
      }
      if (data.voterRole) {
        let role = Role.withId(meta.data.voterRole?.id)
        if (!role) {
          role = Role.create(meta.data.voterRole)
        }
        data.voterRole = role
      }
      return round.update(data)
    }
  }
}
