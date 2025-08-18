import { treePoppy } from '@hylo/presenters/colors'
import Colors from '../../../style/theme-colors'

export default {
  addButton: {

  },
  addIcon: {
    fontSize: 24,
    marginLeft: -3,
    marginRight: 1,
    color: Colors.selected
  },
  fileLabel: {
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center'
  },
  fileLabelText: {
    color: Colors.foreground,
    fontFamily: 'Circular-Book',
    fontSize: 16
  },
  fileIcon: {
    fontSize: 24,
    color: treePoppy,
    marginRight: 4
  }
}
