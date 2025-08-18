import { capeCod } from '@hylo/presenters/colors'
import Colors from '../../style/theme-colors'

const screenMargin = 16
const avatarSize = 112

export default {
  marginContainer: {
    marginHorizontal: screenMargin
  },
  bannerImage: {
    height: 140,
    width: '100%'
  },
  bannerEditButton: {
    position: 'absolute',
    bottom: -2,
    right: -10,
    paddingRight: 15
  },
  bannerImagePicker: {
    height: 140
  },
  avatarW3: {
    alignItems: 'center'
  },
  avatarWrapperWrapper: {
    top: -56,
    marginBottom: -40,
    width: avatarSize
  },
  avatarWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'relative'
  },
  avatarImage: {
    width: avatarSize,
    height: avatarSize,
    borderRadius: avatarSize / 2,
    borderWidth: 3,
    borderColor: 'white'
  },
  avatarEditButton: {
    position: 'absolute',
    top: 83
  },
  editButton: {
    backgroundColor: 'white',
    opacity: 0.9,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    position: 'relative'
  },
  editIcon: {
    top: 2,
    fontSize: 12,
    color: capeCod,
    marginRight: 2
  },
  editButtonText: {
    fontFamily: 'Circular-Book',
    fontSize: 14,
    color: capeCod
  },
  buttonContainer: {
    marginBottom: 30,
    alignItems: 'center'
  },
  buttonWrapper: {
    flexDirection: 'row'
  },
  button: {
    height: 30,
    backgroundColor: Colors.background20,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    borderRadius: 15
  },
  buttonText: {
    color: Colors.selected,
    fontSize: 13,
    fontFamily: 'Circular-Bold'
  }
}
