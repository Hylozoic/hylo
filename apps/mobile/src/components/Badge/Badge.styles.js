import { StyleSheet } from 'react-native'
import Colors from '../../style/theme-colors'

export default StyleSheet.create({
  badge: {
    backgroundColor: Colors.accent,
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
