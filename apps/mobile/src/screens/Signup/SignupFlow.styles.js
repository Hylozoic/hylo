import { StyleSheet } from 'react-native'
import Colors from '../../style/theme-colors'
import { isIOS } from 'util/platform'

const buttonStyle = {
  height: 40,
  fontSize: 16
}

export default {
  container: {
    backgroundColor: Colors.selected,
    flex: 1,
    justifyContent: 'flex-end'
  },
  header: {
    paddingTop: 20,
    marginBottom: 30,
    paddingHorizontal: 20
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20
  },

  //
  title: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'Circular-Bold',
    marginBottom: 8
  },
  subTitle: {
    color: Colors.selected80,
    fontSize: 14,
    fontFamily: 'Circular-Book'
  },

  //
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: isIOS ? 30 : 10,
    paddingTop: 10,
    paddingHorizontal: 10,
          backgroundColor: Colors.selected20
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingBottom: 20
  },
  backButton: {
    ...buttonStyle,
    width: 100,
    color: Colors.muted,
          backgroundColor: Colors.selected40
  },
  continueButton: {
    ...buttonStyle,
    width: 134,
    marginLeft: 'auto',
    color: Colors.selected,
    backgroundColor: Colors.muted,
    disabledColor: Colors.muted,
    disabledBackgroundColor: Colors.foreground30
  },

  //
  headerStyle: {
    backgroundColor: Colors.selected,
    shadowColor: 'transparent'
  },
  headerTitleStyle: {
    color: 'white',
    fontFamily: 'Circular-Bold',
    fontSize: 12
  },
      headerTintColor: Colors.selected60
}
