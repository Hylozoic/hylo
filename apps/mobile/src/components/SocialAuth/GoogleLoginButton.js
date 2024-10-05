import React from 'react'
import Config from 'react-native-config'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import Button from 'components/Button'
import { withTranslation } from 'react-i18next'

class GoogleLoginButton extends React.Component {
  static defaultProps = {
    style: {}
  }

  constructor (props) {
    super(props)
    this.GoogleSignin = props.mocks ? props.mocks.GoogleSignin : GoogleSignin
  }

  componentDidMount () {
    this.GoogleSignin.configure({
      iosClientId: Config.IOS_GOOGLE_CLIENT_ID,
      webClientId: Config.WEB_GOOGLE_CLIENT_ID
    })
  }

  signIn = async () => {
    const { t } = this.props
    try {
      await this.GoogleSignin.hasPlayServices()
      await this.GoogleSignin.signIn()

      const { accessToken } = await this.GoogleSignin.getTokens()

      this.props.onLoginFinished(accessToken)
    } catch (error) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        this.props.createErrorNotification(t('Could not sign in with your Google account'))
      }
    }
  }

  render () {
    const { t } = this.props
    const style = {
      fontSize: 16,
      width: 160,
      height: 40,
      borderRadius: 5,
      backgroundColor: '#dd4b39',
      ...this.props.style,
      icon: {
        fontSize: 16,
        marginRight: 3,
        ...this.props.style.icon ? this.props.style.icon : {}
      }
    }
    const text = this.props.signup
      ? t('Sign up with Google')
      : t('Sign in with Google')

    return (
      <Button
        onPress={this.signIn}
        iconName='Google'
        style={style}
        text={text}
      />
    )
  }
}

export default withTranslation()(GoogleLoginButton)
