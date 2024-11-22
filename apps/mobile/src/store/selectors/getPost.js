import { createSelector as ormCreateSelector } from 'redux-orm'
import presentPost from 'store/presenters/presentPost'
import orm from 'store/models'
import { createSelector } from 'reselect'
import { get } from 'lodash/fp'

const getPost = ormCreateSelector(
  orm,
  (_, props) => props.postId,
  (session, postId) => session?.Post.safeGet({ id: postId })
)

export default getPost

export const getPresentedPost = createSelector(
  getPost,
  (_, props) => get('forGroupId', props),
  (post, forGroupId) => presentPost(post, forGroupId)
)
