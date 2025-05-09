import { gql } from 'urql'
import trackFieldsFragment from '../fragments/trackFieldsFragment'

export default gql`
  mutation EnrollInTrackMutation($trackId: ID) {
    enrollInTrack(trackId: $trackId) {
      ...TrackFields
    }
  }
  ${trackFieldsFragment}
`
