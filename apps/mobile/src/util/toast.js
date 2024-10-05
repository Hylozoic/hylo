import Toast from 'react-native-root-toast'
import { StyleSheet } from 'react-native'
import { defaults } from 'lodash'
import { white40onCaribbeanGreen, white, amaranth } from 'style/colors'

const styles = StyleSheet.create({
  containerStyle: {
    padding: 10,
    backgroundColor: '#000',
    opacity: 1,
    borderRadius: 5
  },
  textStyle: {
    fontSize: 18,
    color: white,
    fontFamily: 'Circular-Bold',
    textAlign: 'center'
  }
})

/**
 * Passthrough to https://github.com/magicismight/react-native-root-toast with hylo default styles
 * @param {*} msg
 * @param {*} props
 */
const showToast = (msg = 'Cheers!', props = {}) => {
  const mergedProps = defaults(props, {
    duration: Toast.durations.LONG,
    position: 34,
    textStyle: styles.textStyle,
    containerStyle: styles.containerStyle,
    backgroundColor: props.isError ? amaranth : white40onCaribbeanGreen,
    shadow: false,
    opacity: 0.95,
    animation: true,
    hideOnPress: true,
    delay: 0
  })
  return Toast.show(msg, mergedProps)
}

const hideToast = (toast) => {
  Toast.hide(toast)
}

export { showToast, hideToast }
