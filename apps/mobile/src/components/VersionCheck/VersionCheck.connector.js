import { connect } from 'react-redux'
import { checkVersion } from './actions'
import { platformName, appVersion } from 'util/platform'
import { Alert, Linking } from 'react-native'

function showAlert (updateType) {
  if (!updateType || !updateType.type) return

  const buttons = [
    {
      text: 'Update Now',
      onPress: () => Linking.openURL(updateType.link)
    }
  ]
  if (updateType.type === 'suggest') {
    buttons.push({
      text: 'Cancel'
    })
  }
  return Alert.alert(
    updateType.title,
    updateType.message,
    buttons,
    { cancelable: false }
  )
}

export function mapDispatchToProps (dispatch) {
  return {
    checkVersion: () =>
      dispatch(checkVersion(platformName, appVersion))
        .then(({ error, payload }) => !error && showAlert(payload))
  }
}

export default connect(null, mapDispatchToProps)
