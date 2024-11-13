import groupFieldsFragment, {
  groupGroupExtensionsFieldsFragment,
  groupGroupTopicsFieldsFragment,
  groupJoinQuestionsFieldsFragment,
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
  withPrerequisiteGroups = false
}) {
  return gql`
    query GroupDetailsQuery ($slug: String) {
      group(slug: $slug) {
        ...GroupFieldsFragment
        ${withExtensions ? '...GroupGroupExtensionsFieldsFragment' : ''}
        ${withWidgets ? '...GroupWidgetsFieldsFragment' : ''}
        ${withTopics ? '...GroupTopicsFieldsFragment' : ''}
        ${withJoinQuestions ? '...GroupJoinQuestionsFieldsFragment' : ''}
        ${withPrerequisiteGroups ? '...GroupPrerequisiteGroupsFieldsFragment' : ''}
      }
      ${groupFieldsFragment}
      ${withExtensions ? groupGroupExtensionsFieldsFragment : ''}
      ${withWidgets ? groupWidgetsFieldsFragment : ''}
      ${withTopics ? groupGroupTopicsFieldsFragment : ''}
      ${withJoinQuestions ? groupJoinQuestionsFieldsFragment : ''}
      ${withPrerequisiteGroups ? groupPrerequisiteGroupsFieldsFragment : ''}
  }
  `
}
