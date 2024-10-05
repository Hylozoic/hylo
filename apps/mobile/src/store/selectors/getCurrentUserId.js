import { createSelector } from 'reselect'
import getMe from './getMe'

const getCurrentUserId = createSelector(
  getMe,
  (me) => {
    return me && me.id
  }
)

export default getCurrentUserId
