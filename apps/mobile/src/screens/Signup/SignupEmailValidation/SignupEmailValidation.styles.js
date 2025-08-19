import { StyleSheet } from 'react-native'
import { white80 } from '@hylo/presenters/colors'
import Colors from '../../../style/theme-colors'
import defaultStyles from '../SignupFlow.styles'

const styles = {
  ...defaultStyles,
  subTitle: {
    ...defaultStyles.subTitle,
    fontSize: 16
  },
  codeFieldRoot: {
    marginHorizontal: 40
  },
  codeFieldCell: {
    flex: 1,
    flexGrow: 1,
    padding: 5,
    margin: 5,
    textAlign: 'center',
    color: Colors.muted,
    fontSize: 24,
    fontWeight: 'bold',
    borderWidth: 2,
    borderRadius: 3,
    borderColor: Colors.selected40
  },
  codeFieldCellSeparator: {
    height: 2,
    width: 10,
    backgroundColor: Colors.muted,
    alignSelf: 'center'
  },
  codeFieldCellFocused: {
    borderColor: Colors.muted
  },
  resendCodeLink: {
    marginTop: 30,
    padding: 10,
    borderRadius: 100,
    alignItems: 'center'
  },
  resendCodeLinkText: {
    justifyContent: 'center',
    color: white80,
    fontWeight: 'bold',
    fontSize: 14
  }
}

export default styles
