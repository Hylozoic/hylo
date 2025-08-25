import { StyleSheet } from 'react-native'
import Colors from '../../style/theme-colors'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.foreground20
  },
  label: {
    fontSize: 16,
    color: Colors.foreground,
    fontFamily: 'Circular-Book'
  },
  value: {
    fontSize: 16,
    color: Colors.selected,
    fontFamily: 'Circular-Book'
  },
  description: {
    fontSize: 14,
    color: Colors.foreground60,
    fontFamily: 'Circular-Book',
    marginTop: 5
  },
  icon: {
    fontSize: 20,
    color: Colors.foreground40
  }
})
