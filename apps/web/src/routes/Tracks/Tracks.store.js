import { COMPLETE_POST_PENDING, CREATE_POST } from 'store/constants'
import { ENROLL_IN_TRACK_PENDING, LEAVE_TRACK_PENDING, UPDATE_TRACK_PENDING, UPDATE_TRACK_ACTION_ORDER_PENDING } from 'store/actions/trackActions'

export function ormSessionReducer (
  { Post, Track, Role, session },
  { type, meta, payload }
) {
  switch (type) {
    case COMPLETE_POST_PENDING: {
      const post = Post.safeGet({ id: meta.postId })
      if (!post) return
      return post.update({ completedAt: new Date().toISOString(), completionResponse: meta.completionResponse })
    }

    case CREATE_POST: {
      if (!meta.trackId || !payload.data.createPost) return
      const track = Track.safeGet({ id: meta.trackId })
      if (!track) return
      track.update({
        numActions: track.numActions + 1
      })
      track.updateAppending({
        posts: [payload.data.createPost.id]
      })
      return track
    }

    case ENROLL_IN_TRACK_PENDING: {
      const track = Track.safeGet({ id: meta.trackId })
      if (!track) return
      return track.update({ isEnrolled: true })
    }

    case LEAVE_TRACK_PENDING: {
      const track = Track.safeGet({ id: meta.trackId })
      if (!track) return
      return track.update({ isEnrolled: false })
    }

    case UPDATE_TRACK_PENDING: {
      const track = Track.safeGet({ id: meta.trackId })
      if (!track) return
      const data = meta.data
      if (data.completionRole) {
        let role = Role.withId(meta.data.completionRole?.id)
        if (!role) {
          role = Role.create(meta.data.completionRole)
        }
        data.completionRole = role
      }
      return track.update(data)
    }

    case UPDATE_TRACK_ACTION_ORDER_PENDING: {
      const { trackId, postId, newOrderIndex } = meta
      const track = Track.safeGet({ id: trackId })
      if (!track) return

      const posts = track.posts.toModelArray().sort((a, b) => a.sortOrder - b.sortOrder)
      const postToMove = posts.find(p => p.id === postId)
      if (!postToMove) return

      // Remove the post to move and reinsert it at the new position
      const filteredPosts = posts.filter(p => p.id !== postId)
      filteredPosts.splice(newOrderIndex, 0, postToMove)

      // Update the sortOrder for all posts
      filteredPosts.forEach((post, index) => {
        post.update({ sortOrder: index })
      })
    }
  }
}
