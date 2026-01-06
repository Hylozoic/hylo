import { gql } from 'urql'

export default gql`
  query FetchFundingRoundQuery($id: ID) {
    fundingRound(id: $id) {
      id
      bannerUrl
      canSubmit
      canVote
      createdAt
      criteria
      description
      group {
        id
        name
        slug
      }
      hideFinalResultsFromParticipants
      isParticipating
      joinedAt
      maxTokenAllocation
      minTokenAllocation
      numParticipants
      numSubmissions
      phase
      publishedAt
      requireBudget
      submissionDescriptor
      submissionDescriptorPlural
      submissions {
        items {
          id
          budget
          commenters(first: 3) {
            id
            name
            avatarUrl
          }
          commentersTotal
          commentsTotal
          createdAt
          details
          linkPreviewFeatured
          location
          myReactions {
            emojiFull
            id
          }
          peopleReactedTotal
          postReactions {
            emojiFull
            id
            user {
              id
              name
            }
          }
          title
          tokensAllocated
          totalTokensAllocated
          type
          updatedAt
          attachments {
            type
            url
            position
            id
          }
          creator {
            id
            name
            avatarUrl
            tagline
          }
          groups {
            id
            name
            slug
          }
          linkPreview {
            description
            id
            imageUrl
            title
            url
          }
          locationObject {
            id
            addressNumber
            addressStreet
            bbox {
              lat
              lng
            }
            center {
              lat
              lng
            }
            city
            country
            fullText
            locality
            neighborhood
            region
          }
          topics {
            id
            name
          }
          members {
            total
            hasMore
            items {
              id
              name
              avatarUrl
              bio
              tagline
              location
            }
          }
        }
      }
      submitterRoles {
        __typename
        ... on CommonRole {
          id
          emoji
          name
        }
        ... on GroupRole {
          id
          emoji
          name
        }
      }
      submissionsCloseAt
      submissionsOpenAt
      title
      tokenType
      tokensRemaining
      totalTokens
      totalTokensAllocated
      updatedAt
      users {
        items {
          id
          avatarUrl
          name
          membershipCommonRoles {
            items {
              id
              commonRoleId
              groupId
              userId
            }
          }
          groupRoles {
            items {
              id
              name
              emoji
              active
              groupId
            }
          }
        }
      }
      allocations {
        tokensAllocated
        submission {
          id
          title
        }
        user {
          id
          name
          avatarUrl
        }
      }
      voterRoles {
        __typename
        ... on CommonRole {
          id
          emoji
          name
        }
        ... on GroupRole {
          id
          emoji
          name
        }
      }
      votingMethod
      votingClosesAt
      votingOpensAt
    }
  }
`
