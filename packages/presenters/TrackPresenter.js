import PostPresenter from './PostPresenter'

export default function TrackPresenter (track, options = {}) {
  if (!track) return track

  return {
    ...track,
    posts: track.posts?.items?.map(post => PostPresenter(post, options)) || [],
    _presented: true
  }
}
