import { StyleSheet } from 'react-native'
import { persimmon } from '@hylo/presenters/colors'

export default StyleSheet.create({
  badgeInner: {
    backgroundColor: persimmon,
    borderRadius: 4,
    height: 8,
    width: 8
  },
  badgeOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 5.5,
    position: 'absolute',
    height: 11,
    width: 11,
    top: 1,
    right: 16
  }
})
