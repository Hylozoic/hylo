import { createNativeStackNavigator } from '@react-navigation/native-stack'
import SignupIntroScreen from '../screens/Signup/SignupIntroScreen'
import {
  SignupEmailValidationScreen,
  SignupRegistrationScreen,
  SignupUploadAvatarScreen,
  SignupSetLocationScreen
} from '../screens/Signup/SignupStepScreens'

const Signup = createNativeStackNavigator()

export default function SignupNavigator () {
  return (
    <Signup.Navigator screenOptions={{ headerShown: false }}>
      <Signup.Screen name='Signup Intro' component={SignupIntroScreen} />
      <Signup.Screen name='SignupEmailValidation' component={SignupEmailValidationScreen} />
      <Signup.Screen name='SignupRegistration' component={SignupRegistrationScreen} />
      <Signup.Screen name='SignupUploadAvatar' component={SignupUploadAvatarScreen} />
      <Signup.Screen name='SignupSetLocation' component={SignupSetLocationScreen} />
    </Signup.Navigator>
  )
}
