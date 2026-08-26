export default function TrackPresenter (track, options = {}) {
  if (!track) return track

  return {
    ...track,
    name: track.space?.name,
    bannerUrl: track.space?.bannerUrl,
    description: track.space?.description,
    // Action posts live on the Track space's track-actions view (collectionPosts)
    space: track.space || null,
    enrolledUsers: track.enrolledUsers?.items || [],
    _presented: true
  }
}
