import { StyleSheet } from 'react-native'
import { nevada, ghost, rhino50, rhino30, caribbeanGreen, rhino60 } from 'style/colors'
import headerStyles from '../MemberHeader.styles.js'

const screenMargin = 16

export default {
  container: {
    backgroundColor: 'white',
    paddingTop: 12,
    paddingHorizontal: screenMargin
  },
  labelWrapper: {
    flexDirection: 'row',
    position: 'relative'
  },
  sectionLabel: {
    color: rhino60,
    fontSize: 14,
    marginTop: 10,
    marginBottom: 8
  },
  bioContainer: {
    // marginTop: 10,
    // marginBottom: 10
  },
  bio: {
    color: nevada,
    fontFamily: 'Circular-Book',
    fontSize: 16,
    marginBottom: 10
  },
  skillsContainer: {
    marginBottom: 5
  },
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  skill: {
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 12,
    height: 24,
    fontFamily: 'Circular-Book',
    fontSize: 10,
    color: rhino50,
    borderWidth: 1,
    borderColor: ghost,
    lineHeight: 22,
    textAlignVertical: 'top',
    textAlign: 'center'
  },
  groupsContainer: {
  },
  groupRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: rhino60,
    flexDirection: 'row',
    alignItems: 'center'
  },
  groupName: {
    color: caribbeanGreen,
    fontSize: 16,
    fontFamily: 'Circular-Book',
    letterSpacing: 0.22
  },
  affiliationRole: {
    fontWeight: 'bold',
    color: nevada
  },
  affiliationPreposition: {
    color: nevada
  },
  affiliationOrgName: {
    fontWeight: 'bold',
    color: nevada
  },
  affiliationOrgNameLink: {
    color: caribbeanGreen
  },
  starIcon: {
    alignSelf: 'center',
    color: caribbeanGreen,
    marginLeft: 5
  },
  memberCount: {
    marginLeft: 'auto',
    color: rhino50,
    fontSize: 16,
    marginRight: 3
  },
  memberIcon: {
    fontSize: 16,
    color: rhino30
  },
  editIcon: {
    ...headerStyles.editIcon,
    top: 5,
    marginLeft: 10
  },
  groupAvatar: {
    height: 24,
    width: 24,
    marginLeft: 5,
    marginRight: 10,
    alignSelf: 'flex-start'
  }
}
