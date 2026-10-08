import { StyleSheet } from 'react-native'
import { persimmon } from '@hylo/presenters/colors'

export default StyleSheet.create({
  badge: {
    backgroundColor: persimmon,
    height: 20,
    width: 20,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Circular-Bold'
  }
})
