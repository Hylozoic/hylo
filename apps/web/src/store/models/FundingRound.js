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
  createdAt: attr(),
  criteria: attr(),
  description: attr(),
  group: fk('Group', 'fundingRounds'),
  isParticipating: attr(),
  maxTokenAllocation: attr(),
  minTokenAllocation: attr(),
  numParticipants: attr(),
  numSubmissions: attr(),
  publishedAt: attr(),
  requireBudget: attr(),
  submissionDescriptor: attr(),
  submissionDescriptorPlural: attr(),
  submissions: many('Post'),
  submissionsCloseAt: attr(),
  submissionsOpenAt: attr(),
  submitterRole: fk('Role', 'roundsCanSubmit'),
  title: attr(),
  tokenType: attr(),
  totalTokens: attr(),
  totalTokensAllocated: attr(),
  users: many('Person'),
  updatedAt: attr(),
  voterRole: fk('Role', 'roundsCanVote'),
  votingMethod: attr(),
  votingClosesAt: attr(),
  votingOpensAt: attr()
}
