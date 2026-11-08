import postFieldsFragment from '../fragments/postFieldsFragment'

/**
 * Fetches a single post.
 * Comments and commenter identities are opt-in (skip for anonymous public viewers).
 * Action-completion fields are opt-in — only request them for action posts.
 */
export default ({ withComments = true, withCompletion = false, withCompletionResponses = false } = {}) =>
`query FetchPost ($id: ID) {
  post(id: $id) {
    ${postFieldsFragment(withComments, withCompletion, withCompletionResponses)}
  }
}`
