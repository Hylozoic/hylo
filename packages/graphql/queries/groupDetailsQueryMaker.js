import { gql } from 'urql'
import groupFieldsFragment from '@hylo/graphql/fragments/groupFieldsFragment'
import groupGroupExtensionsFieldsFragment from '@hylo/graphql/fragments/groupGroupExtensionsFieldsFragment'
import groupGroupTopicsFieldsFragment from '@hylo/graphql/fragments/groupGroupTopicsFieldsFragment'
import groupJoinQuestionsFieldsFragment from '@hylo/graphql/fragments/groupJoinQuestionsFieldsFragment'
import groupPendingInvitationsFieldsFragment from '@hylo/graphql/fragments/groupPendingInvitationsFieldsFragment'
import groupPrerequisiteGroupsFieldsFragment from '@hylo/graphql/fragments/groupPrerequisiteGroupsFieldsFragment'
import groupWidgetsFieldsFragment from '@hylo/graphql/fragments/groupWidgetsFieldsFragment'

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
    }
    ${groupFieldsFragment}
    ${withExtensions ? groupGroupExtensionsFieldsFragment : ''}
    ${withWidgets ? groupWidgetsFieldsFragment : ''}
    ${withTopics ? groupGroupTopicsFieldsFragment : ''}
    ${withJoinQuestions ? groupJoinQuestionsFieldsFragment : ''}
    ${withPrerequisiteGroups ? groupPrerequisiteGroupsFieldsFragment : ''}
    ${withPendingInvitations ? groupPendingInvitationsFieldsFragment : ''}
  `
}
