import { Platform, StyleSheet } from 'react-native'
import { alabaster, mercury } from 'style/colors'

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: alabaster // flag-messages-background-color
  },
  input: {
    fontSize: 14,
    fontFamily: 'Circular-Book',
    paddingBottom: 4,
    borderRadius: 4,
    shadowColor: mercury,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    shadowOpacity: 0.1,
    margin: 8,
    paddingHorizontal: 7,
    paddingVertical: 12,

    // Android-only
    elevation: 1
  },
  messageList: {
    // NOTE: FlatList's `inverted` prop doesn't seem to work on all platforms,
    // but this is essentially how it does it anyway. MessageCard also needs
    // the same treatment to avoid appearing, well, upside down!
    // transform: [{ scaleY: -1 }],
    // paddingRight: 15
  }
})
