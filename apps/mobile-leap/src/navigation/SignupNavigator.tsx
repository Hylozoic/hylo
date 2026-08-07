import { createNativeStackNavigator } from '@react-navigation/native-stack'
import SignupIntroScreen from '../screens/Signup/SignupIntroScreen'
import {
  SignupEmailValidationScreen,
  SignupRegistrationScreen,
  SignupUploadAvatarScreen,
  SignupSetLocationScreen
} from '../screens/Signup/SignupStepScreens'

const Signup = createNativeStackNavigator()

const signupStepOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: '#33D089' },
  headerTintColor: '#ffffff',
  headerTitleStyle: { color: '#ffffff', fontWeight: '700' as const },
  headerShadowVisible: false
}

export default function SignupNavigator () {
  return (
    <Signup.Navigator screenOptions={{ headerShown: false }}>
      <Signup.Screen name='Signup Intro' component={SignupIntroScreen} />
      <Signup.Screen
        name='SignupEmailValidation'
        component={SignupEmailValidationScreen}
        options={{ ...signupStepOptions, title: 'STEP 1/3' }}
      />
      <Signup.Screen
        name='SignupRegistration'
        component={SignupRegistrationScreen}
        options={{ ...signupStepOptions, title: 'STEP 1/3' }}
      />
      <Signup.Screen
        name='SignupUploadAvatar'
        component={SignupUploadAvatarScreen}
        options={{ ...signupStepOptions, title: 'STEP 2/3' }}
      />
      <Signup.Screen
        name='SignupSetLocation'
        component={SignupSetLocationScreen}
        options={{ ...signupStepOptions, title: 'STEP 3/3' }}
      />
    </Signup.Navigator>
  )
}
