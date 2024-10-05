import { StyleSheet } from 'react-native'

import { capeCod } from 'style/colors'

export default StyleSheet.create({
  container: {
    // flex: 1,
    // backgroundColor: 'white',
    // paddingTop: 12,
    // paddingHorizontal: 15,
    // justifyContent: 'flex-end'
  },
  participantRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    alignItems: 'center'
  },
  avatar: {
    marginRight: 20
  },
  name: {
    color: capeCod,
    fontFamily: 'Circular-Bold',
    fontSize: 14
  }
})
