import { gql } from 'urql'
import groupFieldsFragment from '../fragments/groupFieldsFragment'
import groupGroupExtensionsFieldsFragment from '../fragments/groupGroupExtensionsFieldsFragment'
import groupGroupTopicsFieldsFragment from '../fragments/groupGroupTopicsFieldsFragment'
import groupJoinQuestionsFieldsFragment from '../fragments/groupJoinQuestionsFieldsFragment'
import groupPendingInvitationsFieldsFragment from '../fragments/groupPendingInvitationsFieldsFragment'
import groupPrerequisiteGroupsFieldsFragment from '../fragments/groupPrerequisiteGroupsFieldsFragment'
import groupWidgetsFieldsFragment from '../fragments/groupWidgetsFieldsFragment'
import groupContextWidgetsFieldsFragment from '../fragments/groupContextWidgetsFieldsFragment'

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
  withPendingInvitations = false,
  withContextWidgets = false
} = {}) {
  return gql`
    query GroupDetailsQuery ($slug: String, $id: ID) {
      group(slug: $slug, id: $id) {
        ...GroupFieldsFragment
        ${withExtensions ? '...GroupGroupExtensionsFieldsFragment' : ''}
        ${withWidgets ? '...GroupWidgetsFieldsFragment' : ''}
        ${withContextWidgets ? '...GroupContextWidgetsFieldsFragment' : ''}
        ${withTopics ? '...GroupGroupTopicsFieldsFragment' : ''}
        ${withJoinQuestions ? '...GroupJoinQuestionsFieldsFragment' : ''}
        ${withPrerequisiteGroups ? '...GroupPrerequisiteGroupsFieldsFragment' : ''}
        ${withPendingInvitations ? '...GroupPendingInvitationsFieldsFragment' : ''}
      }
    }
    ${groupFieldsFragment}
    ${withExtensions ? groupGroupExtensionsFieldsFragment : ''}
    ${withWidgets ? groupWidgetsFieldsFragment : ''}
    ${withContextWidgets ? groupContextWidgetsFieldsFragment : ''}
    ${withTopics ? groupGroupTopicsFieldsFragment : ''}
    ${withJoinQuestions ? groupJoinQuestionsFieldsFragment : ''}
    ${withPrerequisiteGroups ? groupPrerequisiteGroupsFieldsFragment : ''}
    ${withPendingInvitations ? groupPendingInvitationsFieldsFragment : ''}
  `
}
