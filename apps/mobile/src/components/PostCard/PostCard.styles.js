import { POST_TYPES } from '@hylo/presenters/PostPresenter'
import { capeCod10, rhino60, caribbeanGreen, white, regent, mangoYellow, black } from 'style/colors'

export default {
  childPost: {
    fontFamily: 'Inter',
    fontStyle: 'normal',
    fontWeight: 400,
    fontSize: 12,
    lineHeight: 15,
    color: 'blue',
    opacity: 0.6,
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 12,
    width: '100%'
  },
  childPostIcon: {
    fontWeight: 500,
    marginRight: 2
  },
  childPostInner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'grey',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingBottom: 4,
    paddingRight: 4,
    paddingLeft: 4
  },
  childPostText: {
    fontWeight: 'bold'
  },
  container: {
    backgroundColor: white,
    borderColor: capeCod10,
    borderRadius: 4,
    borderWidth: 1,
    position: 'relative',
    shadowColor: 'rgba(35, 65, 91, 0.3)',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3
  },
  detailsContainer: {
    marginBottom: 16
  },
  images: {
    marginTop: -8,
    marginBottom: 12
  },
  files: {
    marginBottom: 12
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12
  },
  locationIcon: {
    marginRight: 5,
    color: rhino60
  },
  locationText: {
    fontSize: 12,
    color: rhino60
  },
  projectJoinButton: {
    backgroundColor: POST_TYPES.project.backgroundColor,
    color: POST_TYPES.project.primaryColor,
    marginHorizontal: 12,
    marginBottom: 10
  },
  projectMembersContainer: {
    borderTopWidth: 1,
    borderColor: capeCod10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  projectManagementLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12
  },
  donationsLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 10
  },
  memberCount: {
    color: caribbeanGreen
  },
  topics: {
    paddingHorizontal: 7,
    paddingBottom: 10
  },
  topicsOnImage: {
    marginTop: 8
  },
  groups: {
    backgroundColor: 'rgba(225, 229, 233, 0.3)',
    paddingVertical: 5,
    paddingHorizontal: 12
  },
  clickthroughContainer: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    zIndex: 15,
    backgroundColor: mangoYellow,
    borderRadius: 5,
    padding: 20,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  clickthroughText: {
    color: regent,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  clickthroughButton: {
    marginTop: 6,
    width: 120,
    height: 30,
    borderWidth: 1,
    borderColor: regent,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clickthroughButtonText: {
    color: regent
  }
}
