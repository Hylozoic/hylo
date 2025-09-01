import { StyleSheet } from 'react-native'
import Colors from '../../../style/theme-colors'

export default StyleSheet.create({
  topicRow: {
    marginBottom: 10,
    marginHorizontal: 10,
    flexDirection: 'column'
  },
  hashtag: {
    color: Colors.selected,
    fontFamily: 'Circular-Book',
    fontSize: 18,
    fontStyle: 'italic',
    paddingRight: 2
  },
  topicName: {
    color: Colors.selected,
    fontFamily: 'Circular-Book',
    fontSize: 18
  },
  topicTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: -5
  },
  topicDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 7
  },
  detailIcon: {
    color: Colors.foreground40,
    marginRight: 5
  },
  detailText: {
    color: Colors.foreground40,
    fontFamily: 'Circular-Book',
    fontSize: 16,
    marginRight: 10
  }
})
