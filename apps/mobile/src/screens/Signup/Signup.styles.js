import { Dimensions, StyleSheet } from 'react-native'
import loginStyles from 'screens/Login/Login.styles'
import { caribbeanGreen, rhino30, rhino80, white } from '@hylo/presenters/colors'
import { isIOS } from 'util/platform'

const bgImageWidth = Dimensions.get('window').width
const bgImageHeight = Dimensions.get('window').height * 0.25

export default {
  ...loginStyles,
  container: {
    backgroundColor: 'white'
  },
  background: {
    width: bgImageWidth,
    height: bgImageHeight + (isIOS ? 20 : 60),
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  backgroundImage: {
    width: bgImageWidth,
    height: bgImageHeight + (isIOS ? 20 : 60),
    resizeMode: 'cover'
  },
  merkabaImage: {
    height: 97,
    width: 97
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: '5%'
  },
  title: {
    ...loginStyles.title,
    color: white,
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center'
  },
  // Error
  error: loginStyles.error,
  subTitle: {
    ...loginStyles.helpText,
    textAlign: 'center',
    color: white,
    fontSize: 16,
    paddingHorizontal: '20%',
    marginBottom: 20
  },
  labelText: {
    textAlign: 'center',
    marginBottom: 10,
    color: rhino80,
    fontSize: 14,
    fontWeight: 'bold'
  },
  textInput: {
    textAlign: 'center',
    padding: 15,
    borderColor: rhino80,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 14
  },
  errorWrapper: {
    alignItems: 'center',
    marginTop: -10,
    marginBottom: 10
  },
  signupButton: {
    // paddingHorizontal: 10,
    height: 45,
    fontSize: 20,
    marginBottom: 25,
    disabledColor: white,
    disabledBackgroundColor: rhino30
  },
  login: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20
  },
  haveAccount: {
    ...loginStyles.helpText
  },
  loginButton: {
    ...loginStyles.helpText,
    color: caribbeanGreen,
    fontFamily: 'Circular-Book'
  },
  terms: {
    paddingTop: 20,
    paddingHorizontal: 20
  },
  termsText: {
    fontSize: 12
  }
}
