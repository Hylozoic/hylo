import { gql } from 'urql'

export default gql`
  fragment GroupPrerequisiteGroupsFieldsFragment on Group {
    prerequisiteGroups(onlyNotMember: true) {
      items {
        avatarUrl
        id
        name
        settings {
          agreementsLastUpdatedAt
          allowGroupInvites
          askGroupToGroupJoinQuestions
          askJoinQuestions
          hideExtensionData
          locationDisplayPrecision
          publicMemberDirectory
          showSuggestedSkills
        }
        slug
      }
    }
    numPrerequisitesLeft
  }
`
