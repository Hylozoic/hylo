import { StyleSheet } from 'react-native'
import { bigStone } from '@hylo/presenters/colors'
import Colors from '../../style/theme-colors'

export default {
  container: {
    flex: 1
  },
  sectionHeader: {
    fontWeight: 'bold',
    color: Colors.foreground80,
    padding: 15,
    fontSize: 18
  },
  groupRow: {
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.foreground60,
    flexDirection: 'row',
    alignItems: 'center'
  },
  groupAvatar: {
    height: 42,
    width: 42,
    marginLeft: 5,
    marginRight: 10,
    alignSelf: 'flex-start'
  },
  groupRowRight: {
    marginRight: 82
  },
  groupRowText: {
    color: bigStone,
    fontWeight: 'bold',
    marginBottom: 5
  },
  groupRowCounts: {
    color: Colors.mutedForeground,
    fontSize: 12,
    marginBottom: 5
  },
  groupRowDescription: {
    color: Colors.mutedForeground
  },
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
    fontSize: 12
  },
  groupStatus: {
    flexDirection: 'row',
    marginBottom: 5
  },
  groupStatusIcon: {
    fontSize: 14,
    marginRight: 5,
    color: Colors.foreground80
  },
  groupStatusText: {
    fontSize: 14,
    color: Colors.foreground80
  }
}
