import { createSelector } from 'reselect'

export const getCurrentGroupSlug = createSelector(
  state => state.session?.groupSlug,
  currentGroupSlug => currentGroupSlug
)

export default getCurrentGroupSlug
