import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import WorkflowModalHeader from 'navigation/headers/WorkflowModalHeader'
import SignupComponent from 'screens/Signup'
import SignupEmailValidation from 'screens/Signup/SignupEmailValidation'
import SignupRegistration from 'screens/Signup/SignupRegistration'
import SignupUploadAvatar from 'screens/Signup/SignupUploadAvatar'
import SignupSetLocation from 'screens/Signup/SignupSetLocation'
import { white, white20onCaribbeanGreen } from '@hylo/presenters/colors'

const Signup = createStackNavigator()
export default function SignupNavigator () {
  const navigatorProps = {
    screenOptions: {
      // cardStyle: { backgroundColor: white },
      header: headerProps => {
        // Hmmm, maybe should clear current user session...
        const close = () => headerProps.navigation.navigate('Signup Intro')
        return (
          <WorkflowModalHeader
            headerLeftCloseIcon
            headerLeftStyle={{ color: white }}
            headerLeftOnPress={close}
            headerTitleStyle={{ color: white }}
            style={{ backgroundColor: white20onCaribbeanGreen }}
            {...headerProps}
          />
        )
      }
    }
  }

  return (
    <Signup.Navigator {...navigatorProps}>
      <Signup.Screen
        name='Signup Intro' component={SignupComponent}
        options={{ headerShown: false }}
      />
      <Signup.Screen
        name='SignupEmailValidation' component={SignupEmailValidation}
        options={{ title: 'Verify Email' }}
      />
      <Signup.Screen
        name='SignupRegistration' component={SignupRegistration}
        options={{ title: 'STEP 1/3' }}
      />
      <Signup.Screen
        name='SignupUploadAvatar' component={SignupUploadAvatar}
        options={{ title: 'STEP 2/3' }}
      />
      <Signup.Screen
        name='SignupSetLocation' component={SignupSetLocation}
        options={{ title: 'STEP 3/3' }}
      />
    </Signup.Navigator>
  )
}
