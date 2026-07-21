import { FETCH_GROUP_DETAILS } from 'store/constants'
import groupDetailsFragment from '@graphql/fragments/groupDetailsFragment'

/**
 * Fetch group details for the about page
 * @param slug {string} group slug
 * @param accessCode {string} optional access code from invitation link (allows viewing restricted/hidden groups)
 * @param invitationToken {string} optional invitation token from email invite (allows viewing restricted/hidden groups)
 * @param withExtensions {boolean} include group extensions
 * @param withWidgets {boolean} include group widgets
 * @param withTopics {boolean} include group topics
 * @param withJoinQuestions {boolean} include join questions
 * @param withPrerequisites {boolean} include prerequisites
 * @param withContextWidgets {boolean} include context widgets
 */
export default function fetchGroupDetails ({
  slug,
  accessCode,
  invitationToken,
  withExtensions = true,
  withWidgets = false,
  withTopics = true,
  withJoinQuestions = true,
  withPrerequisites = true,
  withContextWidgets = true
}) {
  return {
    type: FETCH_GROUP_DETAILS,
    graphql: {
      query: `query GroupDetailsQuery ($slug: String, $accessCode: String, $invitationToken: String) {
        group(slug: $slug, accessCode: $accessCode, invitationToken: $invitationToken) {
          ${groupDetailsFragment({ withTopics, withJoinQuestions, withPrerequisites, withExtensions, withWidgets, withContextWidgets })}
        }
      }`,
      variables: { slug, accessCode, invitationToken }
    },
    meta: {
      extractModel: 'Group',
      slug
    }
  }
}
