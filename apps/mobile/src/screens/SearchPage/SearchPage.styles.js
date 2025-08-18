import { StyleSheet } from 'react-native'
import { capeCod40, capeCod10 } from '@hylo/presenters/colors'
import Colors from '../../style/theme-colors'

const cardMargin = 15
const cardPadding = 10

const row = {
  flexDirection: 'row'
}

export default {
  container: {
    flex: 1,
    backgroundColor: Colors.background20
  },
  row,
  searchBar: {
    height: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: capeCod40,
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  searchBox: {
    ...row,
    alignItems: 'center',
    height: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: capeCod40,
    borderRadius: 100
  },
  searchIcon: {
    color: capeCod40,
    fontSize: 26,
    marginHorizontal: 5
  },
  textInput: {
    flex: 1,
    height: 50
  },
  tabBar: {
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 30,
    marginBottom: 10
  },
  tab: {
    fontSize: 15,
    color: Colors.foreground30,
    fontFamily: 'Circular-Book'
  },
  active: {
    color: Colors.selected
  },
  postResult: {
    marginHorizontal: cardMargin,
    marginBottom: cardMargin
  },
  commentResult: {
    marginHorizontal: cardMargin,
    marginBottom: cardMargin,
    borderWidth: 1,
    borderColor: capeCod10,
    borderRadius: 4
  },
  personResult: {
    ...row,
    height: 60,
    alignItems: 'center',
    marginHorizontal: cardMargin,
    marginBottom: cardMargin,
    paddingHorizontal: cardPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: capeCod40
  },
  avatar: {
    marginRight: 8
  },
  nameAndLocation: {
    justifyContent: 'space-between'
  },
  name: {
    color: Colors.foreground,
    fontSize: 16,
    paddingBottom: 4
  },
  location: {
    color: Colors.foreground60,
    fontSize: 12
  },
  postTitle: {
    paddingHorizontal: cardPadding
  },
  commentPostHeader: {
    opacity: 0.4
  },
  commentDivider: {
    marginHorizontal: cardMargin,
    borderBottomWidth: 1,
    borderBottomColor: capeCod10,
    marginTop: 9,
    marginBottom: 21
  }
}
