import { StyleSheet } from 'react-native'
import { rhino40, caribbeanGreen } from '@hylo/presenters/colors'

export default StyleSheet.create({
  topicRow: {
    marginBottom: 10,
    marginHorizontal: 10,
    flexDirection: 'column'
  },
  hashtag: {
    color: caribbeanGreen,
    fontFamily: 'Circular-Book',
    fontSize: 18,
    fontStyle: 'italic',
    paddingRight: 2
  },
  topicName: {
    color: caribbeanGreen,
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
    color: rhino40,
    marginRight: 5
  },
  detailText: {
    color: rhino40,
    fontFamily: 'Circular-Book',
    fontSize: 16,
    marginRight: 10
  }
})
