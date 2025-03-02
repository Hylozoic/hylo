import { gql } from 'urql'
import groupFieldsFragment from '@hylo/graphql/fragments/groupFieldsFragment'
import groupPrerequisiteGroupsFieldsFragment from '@hylo/graphql/fragments/groupPrerequisiteGroupsFieldsFragment'

export default gql`
  mutation CreateGroupMutation ($data: GroupInput) {
    createGroup(data: $data) {
      ...GroupFieldsFragment
      ...GroupPrerequisiteGroupsFieldsFragment
      memberships {
        items {
          id
          hasModeratorRole
          person {
            id
          }
          settings {
            agreementsAcceptedAt
            joinQuestionsAnsweredAt
            sendEmail
            showJoinForm
            sendPushNotifications
          }
        }
      }
    }
  }
  ${groupFieldsFragment}
  ${groupPrerequisiteGroupsFieldsFragment}
`
