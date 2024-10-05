import { StyleSheet } from 'react-native'
import { rhino05, rhino80 } from 'style/colors'

export default {
  container: {
    backgroundColor: rhino80,
    flex: 1,
    padding: 20
  },
  divider: {
    color: rhino05,
    marginTop: 10,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: rhino05
  },
  navItem: {
    color: rhino05,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 13
  },
  navItemIcon: {
    color: rhino05,
    fontSize: 28,
    paddingRight: 10
  },
  navItemLabel: {
    color: rhino05,
    fontSize: 28
  }
}
