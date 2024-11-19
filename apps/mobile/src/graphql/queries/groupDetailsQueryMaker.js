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
// withWidgets = false,
// withTopics = true,
// withJoinQuestions = true,
// withPrerequisites = true
export default function groupDetailsQueryMaker ({
  withExtensions = false,
  withWidgets = false,
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
        ${withWidgets ? '...GroupWidgetsFieldsFragment' : ''}
        ${withTopics ? '...GroupGroupTopicsFieldsFragment' : ''}
        ${withJoinQuestions ? '...GroupJoinQuestionsFieldsFragment' : ''}
        ${withPrerequisiteGroups ? '...GroupPrerequisiteGroupsFieldsFragment' : ''}
        ${withPendingInvitations ? '...GroupPendingInvitationsFieldsFragment' : ''}

      }
      ${groupFieldsFragment}
      ${withExtensions ? groupGroupExtensionsFieldsFragment : ''}
      ${withWidgets ? groupWidgetsFieldsFragment : ''}
      ${withTopics ? groupGroupTopicsFieldsFragment : ''}
      ${withJoinQuestions ? groupJoinQuestionsFieldsFragment : ''}
      ${withPrerequisiteGroups ? groupPrerequisiteGroupsFieldsFragment : ''}
      ${withPendingInvitations ? groupPendingInvitationsFieldsFragment : ''}
  }
  `
}
