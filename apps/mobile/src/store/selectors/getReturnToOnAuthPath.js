import { createSelector } from 'reselect'

export default createSelector(
  state => state.returnToOnAuthPath,
  returnToOnAuthPath => returnToOnAuthPath
)
