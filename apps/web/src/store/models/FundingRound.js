import { attr, fk, many, Model } from 'redux-orm'

class FundingRound extends Model {
  toString () {
    return `FundingRound: ${this.title}`
  }
}

export default FundingRound

FundingRound.modelName = 'FundingRound'

FundingRound.fields = {
  id: attr(),
  bannerUrl: attr(),
  canSubmit: attr(),
  canVote: attr(),
  createdAt: attr(),
  criteria: attr(),
  description: attr(),
  group: fk('Group', 'fundingRounds'),
  isParticipating: attr(),
  maxTokenAllocation: attr(),
  minTokenAllocation: attr(),
  numParticipants: attr(),
  numSubmissions: attr(),
  phase: attr(),
  publishedAt: attr(),
  requireBudget: attr(),
  hideFinalResultsFromParticipants: attr(),
  submissionDescriptor: attr(),
  submissionDescriptorPlural: attr(),
  submissions: many('Post'),
  submissionsCloseAt: attr(),
  submissionsOpenAt: attr(),
  submitterRoles: many('Role', 'roundsCanSubmit'),
  title: attr(),
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
