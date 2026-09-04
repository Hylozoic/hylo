import { gql } from 'urql'

export default gql`
  query CheckInvitationQuery ($invitationToken: String, $accessCode: String) {
    checkInvitation (invitationToken: $invitationToken, accessCode: $accessCode) {
      valid
      groupId
      groupSlug
      groupName
      isSpace
      parentGroupSlug
      parentGroupName
    }
  }
`
