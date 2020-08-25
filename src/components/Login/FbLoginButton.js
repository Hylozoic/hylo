import React from 'react'
import MaterialCommunityIcon from 'react-native-vector-icons/FontAwesome5'
import { AccessToken, LoginManager } from 'react-native-fbsdk'
import Button from 'components/Button'

export const permissions = ['public_profile', 'user_friends', 'email']

export default class FbLoginButton extends React.Component {
  constructor (props) {
    super(props)
    if (props.mocks) {
      this.LoginManager = props.mocks.LoginManager
      this.AccessToken = props.mocks.AccessToken
    } else {
      this.LoginManager = LoginManager
      this.AccessToken = AccessToken
    }
  }

  handleResult = (error, result) => {
    const { onLoginFinished } = this.props
    if (error) {
      this.props.createErrorNotification('COULD NOT SIGN IN WITH YOUR FACEBOOK ACCOUNT')
    } else {
      return this.AccessToken.getCurrentAccessToken()
      .then(data => onLoginFinished(data.accessToken.toString()))
    }
  }

  signIn = () => {
    return this.LoginManager.logInWithPermissions(permissions)
    .then(
      result => result.isCancelled || this.handleResult(null, result)
    )
    .catch(() => {
      this.props.createErrorNotification('COULD NOT SIGN IN WITH YOUR FACEBOOK ACCOUNT')
    })
  }

  render () {
    const style = {
      fontSize: 16,
      width: 160,
      height: 40,
      borderRadius: 5,
      backgroundColor: '#1877F2',
      ...this.props.style,
      icon: {
        fontSize: 20,
        marginRight: 5,
        ...this.props.style.icon,
      }
    }
    const text = this.props.signup
      ? 'Continue with Facebook'
      : 'Continue with Facebook'

    return <Button
      text={text}
      customIconRender={renderProps =>
        <MaterialCommunityIcon {...renderProps} name='facebook' />
      }
      style={style}
      onPress={this.signIn}
    />
  }
}
