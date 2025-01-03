import { get } from 'lodash/fp'
import { UPDATE_USER_SETTINGS } from 'store/constants'
import updateUserSettingsMutation from 'graphql/mutations/updateUserSettingsMutation'

export default function updateUserSettings (changes) {
  return {
    type: UPDATE_USER_SETTINGS,
    graphql: {
      query: updateUserSettingsMutation,
      variables: {
        changes
      }
    },
    meta: {
      optimistic: true,
      changes,
      extractModel: [
        {
          getRoot: get('updateMe'),
          modelName: 'Me'
        }
      ]
    }
  }
}
