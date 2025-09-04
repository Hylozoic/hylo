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
          group {
            id
            name
            slug
            avatarUrl
            bannerUrl
            memberCount
            accessibility
            visibility
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
