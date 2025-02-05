import { capeCod } from 'style/colors'
import { isIOS } from 'util/platform'

const streamMargin = 12

export default {
  container: {
    backgroundColor: 'rgba(225, 229, 233, 0.3)',
    flex: 1
  },
  childGroupToggle: {
    marginRight: 12,
    backgroundColor: 'red',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    padding: 6
  },
  listControls: {
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginRight: streamMargin,
    marginLeft: streamMargin
  },
  listControl: {
    flexDirection: 'row'
  },
  optionText: {
    fontSize: 12,
    color: capeCod
  },
  downArrow: {
    top: isIOS ? 1 : 4,
    marginLeft: 4
  },
  steamControlRightSide: {
    flexDirection: 'row',
    display: 'flex',
    alignItems: 'baseline'
  }
}
