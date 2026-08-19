import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from '../constants'
import { sid } from '../helpers'
import { FUNDING_SPACE_ID, MAIN_COORDINATOR_ROLE_ID, MAIN_MEMBER_ROLE_ID } from './groups'

export const FUNDING_ROUND_ID = sid('funding-round', 'spring')

export function buildFundingRound () {
  return {
    id: FUNDING_ROUND_ID,
    title: PLACEHOLDER_NAME,
    description: PLACEHOLDER_COPY,
    criteria: PLACEHOLDER_COPY,
    groupId: FUNDING_SPACE_ID,
    phase: 'voting',
    allowSelfVoting: false,
    hideFinalResultsFromParticipants: false,
    votingMethod: 'token_allocation_constant',
    totalTokens: 100,
    tokenType: PLACEHOLDER_NAME,
    maxTokenAllocation: 40,
    minTokenAllocation: 1,
    requireBudget: true,
    submissionDescriptor: PLACEHOLDER_NAME,
    submissionDescriptorPlural: PLACEHOLDER_NAME,
    numParticipants: 28,
    numSubmissions: 3,
    submissionsTotal: 3,
    totalTokensAllocated: 64,
    tokensRemaining: 36,
    isParticipating: true,
    canSubmit: false,
    canVote: true,
    publishedAt_offset: -86400 * 21,
    submissionsOpenAt_offset: -86400 * 18,
    submissionsCloseAt_offset: -86400 * 7,
    votingOpensAt_offset: -86400 * 6,
    votingClosesAt_offset: 86400 * 7,
    tokensDistributedAt_offset: -86400 * 6,
    submitterRoles: [
      { id: MAIN_MEMBER_ROLE_ID, name: PLACEHOLDER_NAME, emoji: '👤' }
    ],
    voterRoles: [
      { id: MAIN_MEMBER_ROLE_ID, name: PLACEHOLDER_NAME, emoji: '👤' },
      { id: MAIN_COORDINATOR_ROLE_ID, name: PLACEHOLDER_NAME, emoji: '⭐' }
    ]
  }
}
