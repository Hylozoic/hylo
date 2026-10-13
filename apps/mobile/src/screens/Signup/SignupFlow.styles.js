import { caribbeanGreen, white80onCaribbeanGreen, white60onCaribbeanGreen, white20onCaribbeanGreen, white40onCaribbeanGreen, white, rhino30 } from '@hylo/presenters/colors'
import { isIOS } from 'util/platform'

const buttonStyle = {
  height: 40,
  fontSize: 16
}

export default {
  container: {
    backgroundColor: caribbeanGreen,
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
    color: white80onCaribbeanGreen,
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
    backgroundColor: white20onCaribbeanGreen
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
    color: white,
    backgroundColor: white40onCaribbeanGreen
  },
  continueButton: {
    ...buttonStyle,
    width: 134,
    marginLeft: 'auto',
    color: caribbeanGreen,
    backgroundColor: white,
    disabledColor: white,
    disabledBackgroundColor: rhino30
  },

  //
  headerStyle: {
    backgroundColor: caribbeanGreen,
    shadowColor: 'transparent'
  },
  headerTitleStyle: {
    color: 'white',
    fontFamily: 'Circular-Bold',
    fontSize: 12
  },
  headerTintColor: white60onCaribbeanGreen
}
