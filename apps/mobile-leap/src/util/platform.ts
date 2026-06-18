import Constants from 'expo-constants'
import { Platform } from 'react-native'

export const isIOS = Platform.OS === 'ios'
export const isAndroid = Platform.OS === 'android'
export const platformName = isIOS ? 'ios' : 'android'
export const appVersion = Constants.expoConfig?.version ?? '1.0.0'
