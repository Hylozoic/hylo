import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

const getPost = ormCreateSelector(
  orm,
  (state, id) => id,
  ({ Post }, id) => {
    return Post.withId(id)
  }
)

export default getPost
