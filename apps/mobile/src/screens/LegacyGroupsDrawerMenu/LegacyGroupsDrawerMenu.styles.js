import { StyleSheet } from 'react-native'
import { isIOS } from 'util/platform'
import {
  bigStone, rhino, rhino50, persimmon, rhino40, black10onRhino, white, rhino30
} from 'style/colors'

export default {
  container: {
    flex: 1,
    backgroundColor: rhino
  },

  // Header
  headerBackgroundImage: {},
  headerBannerGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%'
  },
  headerContent: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 15,
    paddingTop: 40,
    paddingBottom: 20
  },
  headerAvatar: {
    height: 42,
    width: 42,
    borderRadius: 4,
    marginBottom: 6
  },
  headerText: {
    fontFamily: 'Circular-Bold',
    marginBottom: 10,
    color: white,
    fontSize: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 7
  },
  currentGroupButtons: {
    flexDirection: 'row'
  },
  currentGroupButton: {
    flex: 0.4,
    paddingHorizontal: 5,
    backgroundColor: 'none'
  },


  // Groups rows
  sectionHeader: {
    marginTop: 20
  },
  sectionHeaderText: {
    color: rhino50,
    fontFamily: 'Circular-Book',
    fontSize: 12
  },
  groupSectionSeparator: {
    marginHorizontal: 15,
    marginTop: -10,
    marginBottom: 10,
    borderBottomColor: rhino30,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  rowTouchable: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  groupRow: {
    marginLeft: 10,
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  allStreamsIcon: {
    marginLeft: 5,
    marginRight: 11
  },
  groupAvatar: {
    height: 24,
    width: 24,
    marginRight: 8,
    borderRadius: 4
  },
  groupRowText: {
    fontFamily: 'Circular-Book',
    color: rhino40,
    flex: 1,
    fontSize: 16
  },
  highlight: {
    color: 'white',
    fontFamily: 'Circular-Bold'
  },
  isMember: {
    color: 'white'
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

  // Footer
  createGroupButton: {
    backgroundColor: black10onRhino,
    paddingTop: 15,
    paddingBottom: 15,
    height: 40,
    fontSize: 14,
    paddingRight: '7%',
    paddingLeft: '7%'
  },
  footer: {
    backgroundColor: bigStone,
    padding: 10,
    paddingBottom: isIOS ? 30 : 10,
    flexDirection: 'row',
    alignItems: 'stretch'
  },
  footerContent: {
    flex: 1,
    marginLeft: 10
  },
  footerTopText: {
    color: 'white',
    fontSize: 16
  },
  footerText: {
    color: 'white',
    fontSize: 14
  },
  footerButtons: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4
  },
  footerButton: {
    marginRight: 30
  },

}
