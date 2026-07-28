export default function TrackPresenter (track, options = {}) {
  if (!track) return track

  return {
    ...track,
    // Action posts live on the Track space's track-actions view (collectionPosts)
    space: track.space || null,
    enrolledUsers: track.enrolledUsers?.items || [],
    _presented: true
  }
}
