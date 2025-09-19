import { attr, fk, Model } from 'redux-orm'

class FundingRound extends Model {
  toString () {
    return `FundingRound: ${this.title}`
  }
}

export default FundingRound

FundingRound.modelName = 'FundingRound'

FundingRound.fields = {
  id: attr(),
  createdAt: attr(),
  criteria: attr(),
  description: attr(),
  group: fk('Group', 'fundingRounds'),
  maxTokenAllocation: attr(),
  minTokenAllocation: attr(),
  requireBudget: attr(),
  title: attr(),
  tokenType: attr(),
  totalTokens: attr(),
  updatedAt: attr(),
  votingMethod: attr()
}
