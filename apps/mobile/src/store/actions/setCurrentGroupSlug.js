import { SET_CURRENT_GROUP_SLUG } from 'store/constants'

export default function setCurrentGroupSlug (groupSlug) {
  return {
    type: SET_CURRENT_GROUP_SLUG,
    payload: groupSlug
  }
}
