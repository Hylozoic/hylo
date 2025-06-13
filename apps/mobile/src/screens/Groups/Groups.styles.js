import { StyleSheet } from 'react-native'
import { bigStone, persimmon, rhino60, rhino80, gunsmoke } from 'style/colors'

export default {
  container: {
    flex: 1
  },
  sectionHeader: {
    fontWeight: 'bold',
    color: rhino80,
    padding: 15,
    fontSize: 18
  },
  groupRow: {
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: rhino60,
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
    color: gunsmoke,
    fontSize: 12,
    marginBottom: 5
  },
  groupRowDescription: {
    color: gunsmoke
  },
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
    fontSize: 12
  },
  groupStatus: {
    flexDirection: 'row',
    marginBottom: 5
  },
  groupStatusIcon: {
    fontSize: 14,
    marginRight: 5,
    color: rhino80
  },
  groupStatusText: {
    fontSize: 14,
    color: rhino80
  }
}
