import { gql } from '@urql/core'
import draftFieldsFragment from '../fragments/draftFieldsFragment'

export const saveDraftMutation = gql`
  mutation SaveDraft(
    $type: String!,
    $data: String!,
    $postId: ID,
    $groupId: ID,
    $topicId: ID,
    $messageThreadId: ID,
    $isEdit: Boolean,
    $navigateTo: String
  ) {
    saveDraft(
      type: $type,
      data: $data,
      postId: $postId,
      groupId: $groupId,
      topicId: $topicId,
      messageThreadId: $messageThreadId,
      isEdit: $isEdit,
      navigateTo: $navigateTo
    ) {
      ...DraftFieldsFragment
    }
  }
  ${draftFieldsFragment}
`

export default saveDraftMutation
