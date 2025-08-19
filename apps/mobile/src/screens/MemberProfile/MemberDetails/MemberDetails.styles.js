import { StyleSheet } from 'react-native'
import headerStyles from '../MemberHeader.styles.js'
import Colors from '../../../style/theme-colors'

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
    color: Colors.foreground60,
    fontSize: 14,
    marginTop: 10,
    marginBottom: 8
  },
  bioContainer: {
    // marginTop: 10,
    // marginBottom: 10
  },
  bio: {
    color: Colors.foreground,
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
    color: Colors.foreground50,
    borderWidth: 1,
    borderColor: Colors.primary,
    lineHeight: 22,
    textAlignVertical: 'top',
    textAlign: 'center'
  },
  groupsContainer: {
  },
  groupRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.foreground60,
    flexDirection: 'row',
    alignItems: 'center'
  },
  groupName: {
    color: Colors.selected,
    fontSize: 16,
    fontFamily: 'Circular-Book',
    letterSpacing: 0.22
  },
  affiliationRole: {
    fontWeight: 'bold',
    color: Colors.foreground
  },
  affiliationPreposition: {
    color: Colors.foreground
  },
  affiliationOrgName: {
    fontWeight: 'bold',
    color: Colors.foreground
  },
  affiliationOrgNameLink: {
    color: Colors.selected
  },
  starIcon: {
    alignSelf: 'center',
    color: Colors.selected,
    marginLeft: 5
  },
  memberCount: {
    marginLeft: 'auto',
    color: Colors.foreground50,
    fontSize: 16,
    marginRight: 3
  },
  memberIcon: {
    fontSize: 16,
    color: Colors.foreground30
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
