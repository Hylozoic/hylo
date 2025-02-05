import postFieldsFragment from '../fragments/postFieldsFragment'

export default
`query FetchPost ($id: ID) {
  post(id: $id) {
    ${postFieldsFragment(true)}
  }
}`
