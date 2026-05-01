import { gql } from '@urql/core'
import draftFieldsFragment from '../fragments/draftFieldsFragment'

export const draftQuery = gql`
  query Draft(
    $type: String,
    $postId: ID,
    $groupId: ID,
    $topicId: ID,
    $messageThreadId: ID,
    $isEdit: Boolean
  ) {
    draft(
      type: $type,
      postId: $postId,
      groupId: $groupId,
      topicId: $topicId,
      messageThreadId: $messageThreadId,
      isEdit: $isEdit
    ) {
      ...DraftFieldsFragment
    }
  }
  ${draftFieldsFragment}
`

export default draftQuery
