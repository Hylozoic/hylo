import { StyleSheet } from 'react-native'

import Colors from '../../style/theme-colors'

export default StyleSheet.create({
  avatar: {
    marginLeft: 15,
    marginRight: 15,
    marginTop: 5
  },
  badge: {
    color: Colors.accent,
    fontFamily: 'Circular-Bold',
    fontSize: 12
  },
  container: {
    flexDirection: 'row',
    paddingTop: 15,
    backgroundColor: 'white'
  },
  unreadContainer: {
    backgroundColor: 'rgba(42,201,167,.1)'
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    paddingRight: 15,
    paddingBottom: 15,
    borderBottomColor: Colors.foreground30,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  date: {
    fontSize: 12,
    color: Colors.foreground30,
    fontFamily: 'Circular-Book',
    marginTop: 3
  },
  header: {
    flex: 1,
    flexDirection: 'row'
  },
  name: {
    color: Colors.foreground60,
    fontFamily: 'Circular-Bold',
    fontSize: 14,
    marginTop: 3
  },
  separator: {
    borderBottomColor: Colors.foreground30,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  text: {
    fontFamily: 'Circular-Book',
    fontSize: 14,
    color: Colors.foreground60,
    marginTop: 3
  },
  unreadText: {
    color: Colors.foreground
  },
  title: {
    fontFamily: 'Circular-Bold',
    fontSize: 14,
    color: Colors.foreground60,
    marginTop: 3
  }
})
