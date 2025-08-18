import { capeCod, ghost } from '@hylo/presenters/colors'
import Colors from '../../style/theme-colors'

export default {
  badgeRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: 4
  },
  listControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 5
  },
  searchWrapper: {
    marginRight: 10,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    borderWidth: 1,
    padding: 3,
    borderColor: Colors.foreground50,
    borderRadius: 32
  },
  searchIcon: {
    marginLeft: 2,
    color: Colors.foreground50,
    backgroundColor: 'transparent'
  },
  searchInput: {
    top: 1,
    fontSize: 14,
    fontFamily: 'Circular-Book',
    flex: 1
  },
  sortBy: {
    flexDirection: 'row'
  },
  sortByText: {
    color: Colors.foreground,
    fontFamily: 'Circular-Book'
  },
  downArrow: {
    top: 4,
    marginLeft: 4,
    fontSize: 12,
    color: capeCod
  },
  // Member cells/cards
  cell: {
    flex: 1,
    margin: 8,
    alignItems: 'center'
  },
  memberCell: {
    backgroundColor: '#FFF',
    borderColor: '#EAEBEB',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 4
  },
  avatarSpacing: {
    marginTop: 16
  },
  memberName: {
    fontSize: 18,
    marginTop: 14,
    color: Colors.foreground,
    fontFamily: 'Circular-Black',
    textAlign: 'center'
  },
  memberLocation: {
    fontFamily: 'Circular-Book',
    fontSize: 14,
    textAlign: 'center',
    color: ghost
  },
  memberBio: {
    fontFamily: 'Circular-Book',
    color: Colors.foreground50,
    textAlign: 'center',
    padding: 4
  }
}
