import { SELECT_GROUP } from 'store/constants'

export default function selectGroup (groupId) {
  return {
    type: SELECT_GROUP,
    payload: groupId
  }
}
