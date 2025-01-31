import { gql } from "urql"

export default gql`
  mutation ($playerId: String, $platform: String, $version: String) {
    registerDevice(playerId: $playerId, platform: $platform, version: $version) {
      success
    }
  }
`
