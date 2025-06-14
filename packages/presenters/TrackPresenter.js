import PostPresenter from './PostPresenter'

export default function TrackPresenter (track, options = {}) {
  if (!track) return track

  return {
    ...track,
    currentAction: track.posts?.items?.find(post => !post.completedAt),
    posts: track.posts?.items?.map(post => PostPresenter(post, options)) || [],
    groups: track.groups?.items || [],
    enrolledUsers: track.enrolledUsers?.items || [],
    _presented: true
  }
}
