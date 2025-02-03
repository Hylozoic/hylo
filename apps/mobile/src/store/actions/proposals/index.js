import { gql } from 'urql'

// TODO: URQL - Move these to @hylo/graphql

export const addProposalVoteMutation = gql`
  mutation AddProposalVoteMutation ($optionId: ID, $postId: ID) {
    addProposalVote (optionId: $optionId, postId: $postId) {
      success
      error
    }
  }
`

export const removeProposalVoteMutation = gql`
  mutation RemoveProposalVoteMutation ($optionId: ID, $postId: ID) {
    removeProposalVote (optionId: $optionId, postId: $postId) {
      success
      error
    }
  }
`

export const swapProposalVoteMutation = gql`
  mutation SwapProposalVoteMutation ($addOptionId: ID, $removeOptionId: ID, $postId: ID) {
    swapProposalVote (addOptionId: $addOptionId, removeOptionId: $removeOptionId, postId: $postId) {
      success
      error
    }
  }
`
