import confirmNavigate from 'util/confirmNavigate'
import { navigate } from 'navigation/RootNavigation'
import selectGroup from 'store/actions/selectGroup'
import { ALL_GROUP_ID, PUBLIC_GROUP_ID } from 'store/models/Group'

export default function makeGoToGroup (dispatch, confirm = true) {
  return (groupId, myMemberships, currentGroupId) => {
    if (groupId == currentGroupId) return

    const canViewGroup = myMemberships.find(m => m.group.id === groupId)
      || groupId == PUBLIC_GROUP_ID
      || groupId == ALL_GROUP_ID

    if (canViewGroup) {
      const goToGroup = () => {
        dispatch(selectGroup(groupId))
        navigate('Group Navigation', { groupId })
      }
      confirm
        ? confirmNavigate(goToGroup, {
            title: 'Changing Groups',
            confirmationMessage: 'Do you want to change context to this other group?'
          })
        : goToGroup()
    } else {
      navigate('Group Detail', { groupId })
    }
  }
}
