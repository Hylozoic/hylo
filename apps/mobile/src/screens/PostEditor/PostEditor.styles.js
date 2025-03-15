import { StyleSheet } from 'react-native'
import { isIOS } from 'util/platform'

const typeSelectorIOSDefaults = {
  fontSize: 16,
  fontWeight: 'bold',
  letterSpacing: 0.2,
  borderRadius: 5,
  borderWidth: 1,
  padding: isIOS ? 6 : 2,
  paddingLeft: 8,
  paddingRight: 30,
  marginHorizontal: 0,
  marginBottom: isIOS ? 0 : 0,
  alignItems: 'center'
}

const typeSelectAndroidDefaults = {
  ...typeSelectorIOSDefaults
}

export const typeSelectorStyles = postType => ({
  icon: {
    fontSize: 23,
    marginTop: isIOS ? 6 : 5,
    marginLeft: 0,
    marginRight: 5
  },
  // Temporary fix, can be removed after pending update to react-native-picker-select, see:
  // https://github.com/lawnstarter/react-native-picker-select/issues/636#issuecomment-2486312112
  inputIOSContainer: { pointerEvents: 'none' },
  inputIOS: {
    ...typeSelectorIOSDefaults
  },
  inputAndroid: {
    ...typeSelectAndroidDefaults
  }
})

export const styles = StyleSheet.create({
  headerContainer: {
    height: 60,
    borderBottomWidth: 1
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 5,
    paddingLeft: 10,
    paddingRight: 10
  },
  headerCloseIcon: {
    padding: 0,
    fontSize: 34
  },
  headerSaveButton: {
    width: '25%',
    height: 39,
    fontSize: 18
  },
  typeSelectorWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  formWrapper: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center'
  },
  formContainer: {
  },
  formTop: {
    paddingTop: 12
  },
  formBottom: {
    paddingBottom: 12
  },
  textInputWrapper: {
    borderBottomWidth: 0.5
  },
  textInput: {
    fontSize: 16,
    textAlignVertical: 'top',
    fontFamily: 'Circular-Book',
    margin: 0,
    padding: 0
  },
  titleInputWrapper: {
    paddingBottom: isIOS ? 10 : 0,
    paddingHorizontal: 10
  },
  titleInput: {
    fontSize: 19,
    fontFamily: 'Circular-Medium',
    padding: 0
  },
  titleInputError: {
    fontSize: 14
  },
  detailsInputWrapper: {
    // paddingBottom: isIOS ? 10 : 0
  },
  textInputPlaceholder: {
    fontSize: 16,
    fontFamily: 'Circular-Book'
  },
  section: {
    marginBottom: 10,
    paddingBottom: 10
  },
  sectionLabel: {
    fontFamily: 'Circular-Bold'
  },
  topics: {
    justifyContent: 'center',
    display: 'flex',
    flexDirection: 'column'
  },
  topicPillStyle: {
    marginTop: 5
  },
  topicTextStyle: {
    fontSize: 14
  },
  members: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 0
  },
  pressSelectionSection: {
    borderBottomWidth: 0.5,
    paddingVertical: 10,
    flex: 1,
    justifyContent: 'center'
  },
  pressSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10
  },
  pressSelectionSectionPublicSelected: {
  },
  pressSelectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  pressSelectionLeftText: {
    fontFamily: 'Circular-Bold'
  },
  pressSelectionRight: {
    height: 25,
    width: 25,
    borderRadius: 100,
    borderWidth: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressSelectionRightNoBorder: {
    height: 25,
    width: 25,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressSelectionRightIcon: {
    fontSize: 16
  },
  pressSelectionSwitch: {
    flexGrow: 0,
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }]
  },
  pressSelectionValue: {
    margin: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 5,
    fontSize: 14,
    fontFamily: 'Circular-Book'
  },
  groupRemoveIcon: {
    fontSize: 20
  },
  imageSelector: {
    paddingTop: 10
  },
  buttonBar: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 10
  },
  buttonBarLeft: {
    flexDirection: 'row'
  },
  buttonBarIcon: {
    fontSize: 46
  },
  buttonBarAnnouncement: {
    borderRadius: 10,
    marginTop: -4
  },
  buttonBarAnnouncementIcon: {
    fontSize: 46
  }
})

export default styles
