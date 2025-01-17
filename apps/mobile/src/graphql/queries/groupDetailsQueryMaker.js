import { gql } from 'urql'
import groupFieldsFragment from 'graphql/fragments/groupFieldsFragment'
import groupGroupExtensionsFieldsFragment from 'graphql/fragments/groupGroupExtensionsFieldsFragment'
import groupGroupTopicsFieldsFragment from 'graphql/fragments/groupGroupTopicsFieldsFragment'
import groupJoinQuestionsFieldsFragment from 'graphql/fragments/groupJoinQuestionsFieldsFragment'
import groupPendingInvitationsFieldsFragment from 'graphql/fragments/groupPendingInvitationsFieldsFragment'
import groupPrerequisiteGroupsFieldsFragment from 'graphql/fragments/groupPrerequisiteGroupsFieldsFragment'
import groupWidgetsFieldsFragment from 'graphql/fragments/groupWidgetsFieldsFragment'

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
