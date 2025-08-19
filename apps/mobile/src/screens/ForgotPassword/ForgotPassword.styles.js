import { StyleSheet, Dimensions } from 'react-native'
import Colors from '../../style/theme-colors'
import { isIOS } from 'util/platform'

const screenHeight = Dimensions.get('window').height
const smallScreenFudge = screenHeight < 550 ? 0.6 : 1

const mixins = {
  icon: {
    fontSize: 20,
    marginTop: 10
  },
  paddedRow: {
    paddingRight: 15,
    paddingLeft: 15,
    marginBottom: 11,
    flex: 1,
    flexDirection: 'row',
    zIndex: 0
  },
  triangle: {
    top: 0,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderRightWidth: 15,
    borderLeftWidth: 15,
    borderTopColor: Colors.destructive,
    borderRightColor: 'transparent',
    borderBottomColor: Colors.destructive,
    borderLeftColor: 'transparent',
    paddingBottom: -10,
    marginTop: 12,
    marginLeft: 55,
    position: 'absolute'
  },
  banner: {
    color: 'white',
    paddingTop: 10,
    paddingBottom: 10,
    textAlign: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    marginTop: isIOS ? 20 : 0,
    zIndex: 2
  }
}

export default {
  container: {
    backgroundColor: 'white'
  },
  title: {
    fontSize: 24,
    color: Colors.selected,
    marginBottom: 20 * smallScreenFudge,
    fontFamily: 'Circular-Bold'
  },
  messageText: {
    fontFamily: 'Circular-Book',
    fontSize: 16,
    color: Colors.foreground,
    textAlign: 'left'
  },
  iconOpaque: {
    ...mixins.icon,
    opacity: 0.5
  },
  iconGreen: {
    ...mixins.icon,
    color: Colors.selected
  },
  forgotPassword: {
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20
  },
  forgotPasswordText: {
    color: 'white',
    backgroundColor: 'transparent',
    textAlign: 'center',
    fontFamily: 'Circular-Book',
    fontSize: 18,
    lineHeight: isIOS ? 32 : 28
  },
  paddedRow: mixins.paddedRow,
  paddedRowWithOpacity: {
    ...mixins.paddedRow,
    opacity: 0.7
  },
  labelRow: {
    ...mixins.paddedRow,
    marginBottom: 4,
    justifyContent: 'flex-start'
  },
  paddedBorder: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 5,
    minHeight: 40
  },
  forgotPasswordButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.selected,
    height: 36,
    borderRadius: 50,
    justifyContent: 'center'
  },
  paddedBorderValid: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 5,
    minHeight: 40,
    borderColor: Colors.selected
  },
  leftInputView: {
    height: 40,
    flex: 0.9,
    borderRadius: 5,
    paddingLeft: 10
  },
  errorView: {
    alignSelf: 'stretch'
  },
  emailErrorRow: {
    alignSelf: 'stretch',
    marginLeft: 5,
    marginRight: 5,
    backgroundColor: Colors.destructive,
    padding: 10,
    marginBottom: 3,
    marginTop: -21,
    borderRadius: 30
  },
  errorMessage: {
    color: 'white',
    textAlign: 'center'
  },
  errorBanner: {
    ...mixins.banner,
    backgroundColor: Colors.destructive
  },
  banner: {
    ...mixins.banner,
    backgroundColor: Colors.selected
  },
  textInput: {
    height: 38,
    marginTop: 2
  },
  labelText: {
    fontFamily: 'Circular-Book',
    textAlign: 'left',
    color: Colors.foreground80,
    flex: 1
  },
  rightIconView: {
    height: 40,
    flex: 0.1,
    borderRadius: 5
  },
  emailTriangle: {
    ...mixins.triangle,
    borderTopWidth: 10,
    borderBottomWidth: 0
  }
}
