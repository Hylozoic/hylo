import { Platform } from 'react-native'

export const isIOS = Platform.OS === 'ios'
export const platformName = isIOS ? 'ios' : 'android'