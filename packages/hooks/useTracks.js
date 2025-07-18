import { useQuery } from 'urql'
import groupTracksQuery from '@hylo/graphql/queries/groupTracksQuery'
import TrackPresenter from '@hylo/presenters/TrackPresenter'

export default function useTracks ({ groupId, groupSlug, hideUnpublished = false }, useQueryArgs = {}) {
  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupTracksQuery,
    variables: {
      id: groupId,
      // Note: we don't pass both id and slug - if id exists use that, otherwise use slug
      ...(groupId ? {} : { slug: groupSlug })
    }
  })

  if (error) {
    console.log('!!! URQL error when trying to retrieve tracks:', error)
    return [null, { fetching, error }, reQuery]
  }

  const tracks = data?.group?.tracks?.items || []

  const filteredTracks = hideUnpublished ? tracks.filter(track => track.publishedAt) : tracks

  return [filteredTracks.map(track => TrackPresenter(track)), { fetching, error }, reQuery]
}
