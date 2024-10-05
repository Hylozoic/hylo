import { rhino50, havelockBlue } from 'style/colors'
import { isIOS } from 'util/platform'

export default {
  searchBar: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 3,
    borderColor: rhino50,
    borderRadius: 32
  },
  searchIcon: {
    marginLeft: 2,
    fontSize: 30,
    color: rhino50,
    backgroundColor: 'transparent'
  },
  searchInput: {
    margin: 0,
    padding: 0,
    top: 1,
    fontSize: 14,
    fontFamily: 'Circular-Book',
    flex: 1
  },
  loading: {
    paddingHorizontal: 10
  },
  cancel: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10
  },
  cancelButton: {
    fontSize: 20
  },
  cancelText: {
    marginLeft: 'auto',
    fontWeight: 'bold',
    fontSize: 14,
    color: havelockBlue
  }
}
