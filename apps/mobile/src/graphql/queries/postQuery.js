import postFieldsFragment from '../fragments/postFieldsFragment'

export default
`query PostQuery ($id: ID) {
  post(id: $id) {
    ${postFieldsFragment()}
  }
}`
