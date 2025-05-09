import postFieldsFragment from '../fragments/postFieldsFragment'

export default (withCompletionResponses = false) =>
`query FetchPost ($id: ID) {
  post(id: $id) {
    ${postFieldsFragment(true, false, withCompletionResponses)}
  }
}`
