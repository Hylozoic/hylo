import { attr, fk, many, Model } from 'redux-orm'

class FundingRound extends Model {
  toString () {
    return `FundingRound: ${this.group?.name || this.id}`
  }
}

export default FundingRound

FundingRound.modelName = 'FundingRound'

FundingRound.fields = {
  id: attr(),
  allowLateJoiners: attr(),
  allowSelfVoting: attr(),
  canSubmit: attr(),
  canVote: attr(),
  createdAt: attr(),
  criteria: attr(),
  group: fk('Group', 'fundingRounds'),
  hideFinalResultsFromParticipants: attr(),
  isParticipating: attr(),
  maxTokenAllocation: attr(),
  minTokenAllocation: attr(),
  numParticipants: attr(),
  numSubmissions: attr(),
  phase: attr(),
  requireBudget: attr(),
  submissionDescriptor: attr(),
  submissionDescriptorPlural: attr(),
  submissions: many('Post'),
  submissionsCloseAt: attr(),
  submissionsOpenAt: attr(),
  submitterRoles: many('Role', 'roundsCanSubmit'),
  tokenType: attr(),
  tokensRemaining: attr(),
  totalTokens: attr(),
  totalTokensAllocated: attr(),
  allocations: attr(),
  users: many('Person'),
  updatedAt: attr(),
  voterRoles: many('Role', 'roundsCanVote'),
  votingMethod: attr(),
  votingClosesAt: attr(),
  votingOpensAt: attr()
}
