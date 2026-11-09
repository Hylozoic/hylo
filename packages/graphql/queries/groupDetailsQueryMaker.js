import { gql } from 'urql'
import groupFieldsFragment from '../fragments/groupFieldsFragment'
import groupGroupExtensionsFieldsFragment from '../fragments/groupGroupExtensionsFieldsFragment'
import groupGroupTopicsFieldsFragment from '../fragments/groupGroupTopicsFieldsFragment'
import groupJoinQuestionsFieldsFragment from '../fragments/groupJoinQuestionsFieldsFragment'
import groupPendingInvitationsFieldsFragment from '../fragments/groupPendingInvitationsFieldsFragment'
import groupPrerequisiteGroupsFieldsFragment from '../fragments/groupPrerequisiteGroupsFieldsFragment'

export default function groupDetailsQueryMaker ({
  withExtensions = false,
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
        ${withTopics ? '...GroupGroupTopicsFieldsFragment' : ''}
        ${withJoinQuestions ? '...GroupJoinQuestionsFieldsFragment' : ''}
        ${withPrerequisiteGroups ? '...GroupPrerequisiteGroupsFieldsFragment' : ''}
        ${withPendingInvitations ? '...GroupPendingInvitationsFieldsFragment' : ''}
      }
    }
    ${groupFieldsFragment}
    ${withExtensions ? groupGroupExtensionsFieldsFragment : ''}
    ${withTopics ? groupGroupTopicsFieldsFragment : ''}
    ${withJoinQuestions ? groupJoinQuestionsFieldsFragment : ''}
    ${withPrerequisiteGroups ? groupPrerequisiteGroupsFieldsFragment : ''}
    ${withPendingInvitations ? groupPendingInvitationsFieldsFragment : ''}
  `
}
