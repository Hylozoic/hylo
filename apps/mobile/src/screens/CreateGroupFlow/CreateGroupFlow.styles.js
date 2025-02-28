import { caribbeanGreen, white, white80onCaribbeanGreen, rhino30 } from 'style/colors'
import { StyleSheet } from 'react-native'
import { isIOS } from 'util/platform'

export default {
  container: {
    backgroundColor: caribbeanGreen,
    padding: 20,
    flex: 1
  },
  header: {
    marginBottom: 20
  },
  content: {},
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    marginBottom: 40
  },
  heading: {
    color: white,
    fontSize: 20,
    fontWeight: 'bold',
    paddingBottom: 10
  },
  description: {
    color: white80onCaribbeanGreen,
    marginBottom: 4
  },
  button: {
    width: 134,
    height: 40,
    fontSize: 16,
    backgroundColor: 'white',
    color: caribbeanGreen,
    alignSelf: 'flex-end'
  },
  textInputContainer: {
    marginBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: white80onCaribbeanGreen
  },
  textInputLabel: {
    color: white80onCaribbeanGreen,
    fontWeight: 'bold'
  },
  textInput: {
    color: white,
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: isIOS ? 10 : 1,
  },
  errorBubble: {
    marginTop: -8
  },
  textInputWithButton: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  editContainer: {
    width: 30,
    height: 30
  },
  editText: {
    color: white,
    fontSize: 16,
    marginTop: 10
  },
  pressSelectionSection: {
    borderBottomWidth: 1,
    padding: 15
  },
  pressSelection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pressSelectionRight: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 5
  },
  pressSelectionRightIcon: {
    fontSize: 20
  },
  pressSelectionValue: {
    marginTop: 10,
    fontSize: 16
  },
  groupRemoveIcon: {
    fontSize: 16,
    color: rhino30
  }
}
