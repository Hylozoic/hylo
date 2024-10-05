import { Dimensions } from 'react-native'
const dimensions = Dimensions.get('window')

// TODO: figure out what to do about rotation
export const vw = dimensions.width / 100
export const vh = dimensions.height / 100
