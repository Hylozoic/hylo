import { StyleSheet } from 'react-native'

import { rhino30 } from 'style/colors'

export default StyleSheet.create({
  container: {
    // Transparent background: avoids interfering with box shadow on nearby
    // components
    backgroundColor: 'rgba(0, 0, 0, 0)',
    marginHorizontal: 10,
    marginVertical: 5
  },
  message: {
    color: rhino30,
    fontFamily: 'Circular-Book',
    fontSize: 11
  }
})
