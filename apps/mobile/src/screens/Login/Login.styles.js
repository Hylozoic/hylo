import { Dimensions, StyleSheet } from 'react-native'
import { amaranth, caribbeanGreen, rhino60, rhino80 } from '@hylo/presenters/colors'

const screenHeight = Dimensions.get('window').height
const smallScreenFudge = screenHeight < 550 ? 0.6 : 1

const mixins = {
  helpText: {
    fontFamily: 'Circular-Book',
    fontSize: 14,
    color: rhino60
  },
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
    borderTopColor: '#EE4266',
    borderRightColor: 'transparent',
    borderBottomColor: '#EE4266',
    borderLeftColor: 'transparent',
    paddingBottom: -10,
    marginTop: 12,
    marginLeft: 55,
    position: 'absolute'
  }
}

export default {
  container: {
    backgroundColor: 'white'
  },
  localeContainer: {
    marginTop: 40,
    flexDirection: 'row',
    flex: 1,
    alignSelf: 'flex-start'
  },
  localeContents: {
    marginLeft: 10
  },
  banner: {
    color: 'white',
    paddingTop: 50,
    paddingBottom: 10,
    textAlign: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2
  },
  bannerError: {
    backgroundColor: amaranth
  },
  bannerMessage: {
    backgroundColor: caribbeanGreen
  },
  logo: {
    height: 80,
    width: 80,
    marginTop: (screenHeight - 580) * 0.4,
    marginBottom: 10
  },
  title: {
    fontSize: 24,
    color: caribbeanGreen,
    marginBottom: 20 * smallScreenFudge,
    fontFamily: 'Circular-Bold'
  },
  iconOpaque: {
    ...mixins.icon,
    opacity: 0.5
  },
  iconGreen: {
    ...mixins.icon,
    color: caribbeanGreen
  },
  login: {
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center'
  },
  forgotPasswordText: {
    fontFamily: 'Circular-Book',
    fontSize: 14,
    color: caribbeanGreen
  },
  loginText: {
    color: 'white',
    backgroundColor: 'transparent',
    textAlign: 'center',
    fontFamily: 'Circular-Book',
    fontSize: 18,
    lineHeight: 34
  },

  // Signup
  signupText: {
    ...mixins.helpText,
    fontSize: 16
  },
  signup: {
    marginTop: 30,
    marginBottom: 20,
    flexDirection: 'row'
  },
  signupLink: {
    fontSize: 16,
    color: caribbeanGreen,
    fontFamily: 'Circular-Bold'
  },

  // Misc
  helpText: mixins.helpText,
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
    minHeight: 45
  },
  paddedBorderValid: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 5,
    minHeight: 45,
    borderColor: caribbeanGreen
  },
  loginButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: caribbeanGreen,
    height: 36,
    borderRadius: 50,
    justifyContent: 'center',
    marginTop: 5
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
    backgroundColor: '#EE4266',
    padding: 10,
    marginBottom: 3,
    marginTop: -21,
    borderRadius: 30
  },
  errorMessage: {
    color: 'white',
    textAlign: 'center'
  },
  textInput: {
    height: 38,
    marginTop: 2
  },
  labelText: {
    fontFamily: 'Circular-Book',
    textAlign: 'left',
    color: rhino80,
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
