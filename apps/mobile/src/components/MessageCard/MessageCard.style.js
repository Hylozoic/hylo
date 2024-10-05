import { StyleSheet } from 'react-native'
import { alabaster, capeCod, rhino30 } from 'style/colors'

export default StyleSheet.create({
  body: {
    flexDirection: 'column',
    flex: 0.9,
    paddingLeft: 10
  },
  container: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: alabaster // flag-messages-background-color
  },
  date: {
    fontSize: 12,
    color: rhino30,
    fontFamily: 'Circular-Book',
    marginTop: 3
  },
  name: {
    color: capeCod,
    fontFamily: 'Circular-Bold'
  },
  padTopNoCreator: {
    paddingTop: 0,
    marginTop: -10
  },
  padLeftNoAvatar: {
    paddingLeft: 44
  }
})
