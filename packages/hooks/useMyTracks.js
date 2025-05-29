import { useQuery } from 'urql'
import myTracksQuery from '@hylo/graphql/queries/myTracksQuery'
import TrackPresenter from '@hylo/presenters/TrackPresenter'

export default function useMyTracks ({
  autocomplete = '',
  first = 20,
  offset = 0,
  order = 'asc',
  sortBy = 'enrolled_at'
} = {}, useQueryArgs = {}) {
  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: myTracksQuery,
    variables: {
      autocomplete,
      first,
      offset,
      order,
      sortBy
    }
  })

  if (error) {
    console.log('!!! URQL error when trying to retrieve my tracks:', error)
    return [null, { fetching, error }, reQuery]
  }

  const tracks = (data?.me?.tracksEnrolledIn?.items || [])
    .filter(track => track.publishedAt)
    .map(track => TrackPresenter(track))

  return [tracks, { fetching, error }, reQuery]
}
