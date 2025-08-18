import { white, white80 } from '@hylo/presenters/colors'
import Colors from '../../../style/theme-colors'
import defaultStyles from '../SignupFlow.styles'

const imagePickerChild = {
  width: 138,
  height: 138,
  borderRadius: 70,
  marginBottom: 15
}

export default {
  ...defaultStyles,
  header: {
    ...defaultStyles.header,
    alignItems: 'center'
  },
  content: {
    ...defaultStyles.content,
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    ...imagePickerChild
  },
  imagePickerBackground: {
    ...imagePickerChild,
    backgroundColor: Colors.selected40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageLoading: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  cameraIcon: {
    fontSize: 60,
    color: 'white'
  }
}
