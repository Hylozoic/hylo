import getCurrentGroupSlug from './getCurrentGroupSlug'
import { createSelector } from 'reselect'
import getGroup from './getGroup'

const getCurrentGroup = createSelector(
  state => state,
  getCurrentGroupSlug,
  (state, currentGroupSlug) => getGroup(state, { slug: currentGroupSlug })
)

export default getCurrentGroup
