import React, { useLayoutEffect } from 'react'
import { StyleSheet } from 'react-native'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { isIOS } from 'util/platform'
import ModalHeader from 'navigation/headers/ModalHeader'
import useLogout from 'hooks/useLogout'
import confirmDiscardChanges from 'util/confirmDiscardChanges'
import UserSettingsWebView from 'screens/UserSettingsWebView'
import LocaleSelector from 'components/LocaleSelector/LocaleSelector'
import { alabaster, capeCod, rhino, rhino30, rhino40 } from 'style/colors'

const UserSettings = createMaterialTopTabNavigator()
export default function UserSettingsTabsNavigator ({ navigation, route }) {
  const initialURL = useSelector(state => state.initialURL)
  const { t } = useTranslation()
  const logout = useLogout()
  const navigatorProps = {
    screenOptions: {
      animationEnabled: !initialURL,
      lazy: true,
      tabBarActiveTintColor: rhino,
      tabBarInactiveTintColor: rhino40,
      tabBarIndicatorStyle: {
        backgroundColor: 'transparent'
      },
      tabBarLabelStyle: {
        fontFamily: 'Circular-Bold',
        fontSize: 14,
        textTransform: 'none'
      },
      tabBarScrollEnabled: true,
      tabBarStyle: styles.tabBarStyle,
      swipeEnabled: false
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Settings',
      headerShown: true,
      headerStyle: { backgroundColor: capeCod },
      headerTitleStyle: { color: rhino30 },
      header: headerProps => (
        <ModalHeader
          headerTransparent={false}
          {...headerProps}
          // Hides "X button
          headerLeft={() => (<LocaleSelector small dark />)}
          // // Bring the below back while hiding `TabBar`
          // // to force reload of User after settings changed:
          // headerLeftConfirm={true}
          // headerLeftCloseIcon={false}
          // headerLeftOnPress={() => {
          //   dispatch(fetchCurrentUser())
          //   navigation.navigate('Home Tab')
          // }}
          // headerRight={()=> <Button text="Logout"></Button>}
          headerRightButtonLabel='Logout'
          headerRightButtonOnPress={() => confirmDiscardChanges({
            title: '',
            confirmationMessage: 'Are you sure you want to logout?',
            continueButtonText: 'Cancel',
            disgardButtonText: 'Yes',
            onDiscard: async () => logout(),
            t
          })}
          headerRightButtonStyle={{ color: alabaster }}
        />
      )
    })
  }, [navigation, route])

  console.log('does this get called? at alll?')
  // Note: "ERROR  Warning: A props object containing a "key" prop is being spread into JSX"
  // will appear in logs from this area. This is a known issue in React Navigation material-top-tabs
  // and RN 0.76. It is only a deprecation warning, and can be patched as per
  // https://github.com/react-navigation/react-navigation/issues/11989
  // otherwise it will likely be resolved when we move up to React Navigation 7

  return (
    <UserSettings.Navigator {...navigatorProps}>
      <UserSettings.Screen
        name='Edit Profile'
        component={UserSettingsWebView}
        initialParams={{
          path: '/my/edit-profile'
        }}
      />
      <UserSettings.Screen
        name='Afflilations'
        component={UserSettingsWebView}
        initialParams={{
          path: '/my/groups'
        }}
      />
      <UserSettings.Screen
        name='Invites &amp; Requests'
        component={UserSettingsWebView}
        initialParams={{
          path: '/my/invitations'
        }}
      />
      <UserSettings.Screen
        name='Notifications'
        component={UserSettingsWebView}
        initialParams={{
          path: '/my/notifications'
        }}
      />
      <UserSettings.Screen
        name='Account'
        component={UserSettingsWebView}
        initialParams={{
          path: '/my/account'
        }}
      />
      <UserSettings.Screen
        name='Saved Searches'
        component={UserSettingsWebView}
        initialParams={{
          path: '/my/saved-searches'
        }}
      />
      <UserSettings.Screen
        name='Terms & Privacy'
        component={UserSettingsWebView}
        initialParams={{
          uri: 'https://hylo-landing.surge.sh/terms'
        }}
      />
    </UserSettings.Navigator>
  )
}

const styles = {
  tabBarStyle: (
    isIOS
      ? {
          display: 'flex',
          backgroundColor: alabaster
        }
      : {
          display: 'flex',
          backgroundColor: alabaster,
          borderTopWidth: StyleSheet.hairlineWidth
        }
  )
}
