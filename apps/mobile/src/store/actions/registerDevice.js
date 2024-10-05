import { Platform } from 'react-native'

const REGISTER_DEVICE = 'REGISTER_DEVICE'

export default function registerDevice (playerId) {
  return {
    type: REGISTER_DEVICE,
    graphql: {
      query: `
        mutation ($playerId: String, $platform: String, $version: String) {
          registerDevice(playerId: $playerId, platform: $platform, version: $version) {
            success
          }
        }
      `,
      variables: {
        playerId,
        platform: Platform.OS + (__DEV__ ? '_dev' : ''),
        version: '2' // TODO supply real version here
      }
    }
  }
}
