import { gql } from 'urql'
import trackFieldsFragment from '../fragments/trackFieldsFragment'

export default gql`
  mutation LeaveTrackMutation($trackId: ID) {
    leaveTrack(trackId: $trackId) {
      ...TrackFields
    }
  }
  ${trackFieldsFragment}
`
