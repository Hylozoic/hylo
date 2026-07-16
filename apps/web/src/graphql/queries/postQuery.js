import postFieldsFragment from '../fragments/postFieldsFragment'

/**
 * Fetches a single post with comments.
 * Action-completion fields are opt-in — only request them for action posts.
 */
export default ({ withCompletion = false, withCompletionResponses = false } = {}) =>
`query FetchPost ($id: ID) {
  post(id: $id) {
    ${postFieldsFragment(true, withCompletion, withCompletionResponses)}
  }
}`
