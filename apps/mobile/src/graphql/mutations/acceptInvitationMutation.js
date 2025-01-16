import { gql } from 'urql'
// import { AnalyticsEvents } from '@hylo/shared'

// TODO: URQL - analytics: AnalyticsEvents.GROUP_INVITATION_ACCEPTED
export default gql`
  mutation AcceptInvitationMutation ($invitationToken: String, $accessCode: String) {
    useInvitation (invitationToken: $invitationToken, accessCode: $accessCode) {
      membership {
        id
        group {
          id
          accessibility
          name
          settings {
            agreementsLastUpdatedAt
            allowGroupInvites
            askJoinQuestions
            askGroupToGroupJoinQuestions
            publicMemberDirectory
            showSuggestedSkills
          }
          slug
          visibility
        }
        person {
          id
        }
        settings {
          agreementsAcceptedAt
          joinQuestionsAnsweredAt
          showJoinForm
        }
      }
      error
    }
  }
`
