import React, { useEffect } from 'react'
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication'
import { useTranslation } from 'react-i18next'

export async function onAppleButtonPress ({
  authorizedCallback,
  createErrorNotification,
  t
}) {
  // performs login request
  try {
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME]
    })

    // ** Required to keep from going back to Apple server every login before session is expired:
    //     See "Manage the User Session": https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
    //
    // get current authentication state for user
    // /!\ This method must be tested on a real device. On the iOS simulator it always throws an error.
    const credentialState = await appleAuth.getCredentialStateForUser(appleAuthRequestResponse.user)
    // use credentialState response to ensure the user is authenticated
    if (credentialState === appleAuth.State.AUTHORIZED) {
      // user is authenticated
      authorizedCallback(appleAuthRequestResponse)
    }
  } catch (error) {
    if (error.code !== appleAuth.Error.CANCELED) {
      await createErrorNotification(t('Could not sign in with your Apple account'))
    }
  }
}

export default function AppleLoginButton ({
  onLoginFinished,
  createErrorNotification,
  style: providedStyle,
  signup
}) {
  const { t } = useTranslation()
  useEffect(() => {
    if (!appleAuth.isSupported) return
    // onCredentialRevoked returns a function that will remove the event listener. useEffect will call this function when the component unmounts
    return appleAuth.onCredentialRevoked(async () => {
      console.warn(t('If this function executes, User Credentials have been Revoked'))
    })
  }, []) // passing in an empty array as the second argument ensures this is only ran once when component mounts initially.

  const style = {
    height: 40,
    ...providedStyle
  }

  return (
    <AppleButton
      buttonStyle={AppleButton.Style.BLACK}
      buttonType={signup
        ? AppleButton.Type.SIGN_UP
        : AppleButton.Type.SIGN_IN}
      cornerRadius={5}
      style={style}
      onPress={() => onAppleButtonPress({
        authorizedCallback: onLoginFinished,
        createErrorNotification,
        t
      })}
    />
  )
}