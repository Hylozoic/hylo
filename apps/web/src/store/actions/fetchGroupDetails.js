import { FETCH_GROUP_DETAILS } from 'store/constants'
import groupDetailsFragment from '@graphql/fragments/groupDetailsFragment'

export default function fetchGroupDetails ({
  slug,
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
      query: `query GroupDetailsQuery ($slug: String) {
        group(slug: $slug) {
          ${groupDetailsFragment({ withTopics, withJoinQuestions, withPrerequisites, withExtensions, withWidgets, withContextWidgets })}
        }
      }`,
      variables: { slug }
    },
    meta: {
      extractModel: 'Group',
      slug
    }
  }
}
