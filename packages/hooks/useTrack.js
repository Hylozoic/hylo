import { useQuery } from 'urql'
import fetchTrackQuery from '@hylo/graphql/queries/fetchTrackQuery'
import TrackPresenter from '@hylo/presenters/TrackPresenter'

export default function useTrack ({ trackId }, useQueryArgs = {}) {
  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: fetchTrackQuery,
    variables: {
      id: trackId
    }
  })

  if (error) {
    console.log('!!! URQL error when trying to retrieve track:', error)
    return [null, { fetching, error }, reQuery]
  }

  const presentedTrack = TrackPresenter(data?.track)

  return [presentedTrack, { fetching, error }, reQuery]
}
