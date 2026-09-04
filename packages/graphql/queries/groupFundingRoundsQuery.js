import { gql } from 'urql'

export default gql`
  query GroupFundingRoundsQuery(
    $id: ID
    $first: Int
    $offset: Int
    $order: String
    $published: Boolean
    $search: String
    $sortBy: String
  ) {
    group(id: $id) {
      id
      fundingRounds(
        first: $first
        offset: $offset
        order: $order
        sortBy: $sortBy
        published: $published
        search: $search
      ) {
        items {
          id
          allowLateJoiners
          allowSelfVoting
          createdAt
          criteria
          group {
            id
            name
            slug
            description
            bannerUrl
            status
          }
          isParticipating
          hideFinalResultsFromParticipants
          maxTokenAllocation
          minTokenAllocation
          numParticipants
          numSubmissions
          phase
          requireBudget
          showRealtimeVotes
          submissionDescriptor
          submissionDescriptorPlural
          submissionsCloseAt
          submissionsOpenAt
          tokenType
          totalTokens
          totalTokensAllocated
          updatedAt
          votingMethod
          votingOpensAt
          votingClosesAt
          users {
            items {
              id
              name
              avatarUrl
            }
          }
        }
      }
    }
  }`
