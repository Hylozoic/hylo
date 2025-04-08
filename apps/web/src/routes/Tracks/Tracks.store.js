import { COMPLETE_POST_PENDING } from 'store/constants'
import { ENROLL_IN_TRACK_PENDING, LEAVE_TRACK_PENDING, UPDATE_TRACK_PENDING } from 'store/actions/trackActions'

export function ormSessionReducer (
  { Post, Track },
  { type, meta, payload }
) {
  switch (type) {
    case COMPLETE_POST_PENDING: {
      const post = Post.safeGet({ id: meta.postId })
      if (!post) return
      return post.update({ completedAt: new Date(), completionResponse: meta.completionResponse })
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
      return track.update(meta.data)
    }
  }
}
