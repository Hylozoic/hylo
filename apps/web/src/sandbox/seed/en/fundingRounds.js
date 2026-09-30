import { sid } from '../helpers'
import { FUNDING_SPACE_ID, MAIN_ADMINISTRATOR_ROLE_ID, MAIN_MEMBER_ROLE_ID } from './groups'

export const FUNDING_ROUND_ID = sid('funding-round', 'spring')

export function buildFundingRound () {
  return {
    id: FUNDING_ROUND_ID,
    criteria: 'Projects should:\n• Be led by or deeply connected to Bay Area communities\n• Demonstrate clear regenerative impact on people, place, or ecosystem\n• Have a realistic plan and budget under $10,000\n• Benefit people beyond the project team\n• Align with Terran values: mutual aid, bioregional stewardship, and collective liberation',
    groupId: FUNDING_SPACE_ID,
    phase: 'voting',
    allowSelfVoting: false,
    hideFinalResultsFromParticipants: false,
    votingMethod: 'token_allocation_constant',
    totalTokens: 100,
    tokenType: 'Regen Token',
    maxTokenAllocation: 40,
    minTokenAllocation: 1,
    requireBudget: true,
    submissionDescriptor: 'Project',
    submissionDescriptorPlural: 'Projects',
    numParticipants: 28,
    numSubmissions: 5,
    submissionsTotal: 5,
    totalTokensAllocated: 91,
    tokensRemaining: 9,
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
      { id: MAIN_MEMBER_ROLE_ID, name: 'Member', emoji: '🌱' }
    ],
    voterRoles: [
      { id: MAIN_MEMBER_ROLE_ID, name: 'Member', emoji: '🌱' },
      { id: MAIN_ADMINISTRATOR_ROLE_ID, name: 'Administrator', emoji: '🪄' }
    ]
  }
}
