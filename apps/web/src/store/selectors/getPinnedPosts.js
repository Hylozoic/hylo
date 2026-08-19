import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'

/**
 * Posts pinned in a group (groups_posts.pinned_at set), presented.
 * Fed by any posts fetch that includes postMemberships { pinned }.
 */
const getPinnedPosts = ormCreateSelector(
  orm,
  (state, groupId) => String(groupId || ''),
  (session, groupId) => {
    if (!groupId) return []
    return session.Post.all().toModelArray()
      .filter(post => post.postMemberships?.toRefArray?.().some(pm =>
        pm.pinned && String(pm.group) === groupId))
      .map(post => presentPost(post))
  }
)

export default getPinnedPosts
