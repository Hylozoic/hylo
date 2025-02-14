import { capeCod20, pictonBlue, alabaster, amaranth } from 'style/colors'
import { isIOS } from 'util/platform'

export default {
  container: {
    backgroundColor: alabaster, // flag-messages-background-color
    position: 'relative',
    flex: 1
  },
  // participants
  addParticipantButtonWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addParticipantButton: {
    backgroundColor: pictonBlue,
    width: 150,
    fontSize: 14,
    height: 36
  },
  participants: {
    padding: 12,
    borderTopWidth: isIOS ? 0 : 1,
    borderTopColor: capeCod20,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  },
  participant: {
    borderWidth: 1,
    borderColor: capeCod20,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    marginRight: 3,
    marginLeft: 3,
    marginBottom: 5,
    paddingLeft: 6,
    paddingRight: 5,
    flexBasis: 'auto'
  },
  participantName: {
    maxWidth: 99,
    fontFamily: 'Circular-Bold'
  },
  personAvatar: {
    marginRight: 10
  },
  participantRemoveIcon: {
    paddingLeft: 5,
    fontSize: 20,
    color: amaranth,
    marginRight: 'auto'
  }
}
