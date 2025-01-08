import groupFieldsFragment, {
  groupGroupExtensionsFieldsFragment,
  groupGroupTopicsFieldsFragment,
  groupJoinQuestionsFieldsFragment,
  groupPendingInvitationsFieldsFragment,
  groupPrerequisiteGroupsFieldsFragment,
  groupWidgetsFieldsFragment
} from 'graphql/fragments/groupFieldsFragment'
import { gql } from 'urql'

// Note: The previous defaults args for fetchGroupDetails were:
// withExtensions = true,
// withContextWidgets = false,
// withTopics = true,
// withJoinQuestions = true,
// withPrerequisites = true
export default function groupDetailsQueryMaker ({
  withExtensions = false,
  withContextWidgets = false,
  withTopics = false,
  withJoinQuestions = false,
  withPrerequisiteGroups = false,
  withPendingInvitations = false
} = {}) {
  return gql`
    query GroupDetailsQuery ($slug: String, $id: ID) {
      group(slug: $slug, id: $id) {
        ...GroupFieldsFragment
        ${withExtensions ? '...GroupGroupExtensionsFieldsFragment' : ''}
        ${withContextWidgets ? '...GroupContextWidgetsFieldsFragment' : ''}
        ${withTopics ? '...GroupGroupTopicsFieldsFragment' : ''}
        ${withJoinQuestions ? '...GroupJoinQuestionsFieldsFragment' : ''}
        ${withPrerequisiteGroups ? '...GroupPrerequisiteGroupsFieldsFragment' : ''}
        ${withPendingInvitations ? '...GroupPendingInvitationsFieldsFragment' : ''}
      }
    }
    ${groupFieldsFragment}
    ${withExtensions ? groupGroupExtensionsFieldsFragment : ''}
    ${withContextWidgets ? groupWidgetsFieldsFragment : ''}
    ${withTopics ? groupGroupTopicsFieldsFragment : ''}
    ${withJoinQuestions ? groupJoinQuestionsFieldsFragment : ''}
    ${withPrerequisiteGroups ? groupPrerequisiteGroupsFieldsFragment : ''}
    ${withPendingInvitations ? groupPendingInvitationsFieldsFragment : ''}
  `
}
