import { gql } from 'urql'
import trackFieldsFragment from '../fragments/trackFieldsFragment'

export default gql`
  query FetchTrackQuery ($id: ID) {
    track (id: $id) {
      ...TrackFields
      space {
        id
        slug
        type
        homeRoute
        parentGroup {
          id
          slug
        }
      }
    }
  }
  ${trackFieldsFragment}
`
