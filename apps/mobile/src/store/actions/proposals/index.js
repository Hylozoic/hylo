import { gql } from 'urql'
import {
  ADD_PROPOSAL_VOTE,
  REMOVE_PROPOSAL_VOTE,
  SWAP_PROPOSAL_VOTE
} from 'store/constants'

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

export function addProposalVote ({ optionId, postId }) {
  return {
    type: ADD_PROPOSAL_VOTE,
    graphql: {
      query: addProposalVoteMutation,
      variables: { optionId, postId }
    },
    meta: {
      optionId,
      postId,
      optimistic: true
    }
  }
}

export function removeProposalVote ({ optionId, postId }) {
  return {
    type: REMOVE_PROPOSAL_VOTE,
    graphql: {
      query: removeProposalVoteMutation,
      variables: { optionId, postId }
    },
    meta: {
      optionId,
      postId,
      optimistic: true
    }
  }
}

export function swapProposalVote ({ postId, addOptionId, removeOptionId }) {
  return {
    type: SWAP_PROPOSAL_VOTE,
    graphql: {
      query: swapProposalVoteMutation,
      variables: { postId, addOptionId, removeOptionId }
    },
    meta: {
      postId,
      addOptionId,
      removeOptionId,
      optimistic: true
    }
  }
}
