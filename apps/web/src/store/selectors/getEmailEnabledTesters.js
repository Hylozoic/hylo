import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

const getEmailEnabledTesters = ormCreateSelector(
  orm,
  session => {
    return session.EmailEnabledTester.all().toModelArray()
  }
)

export default getEmailEnabledTesters
