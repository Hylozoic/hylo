import { useQuery } from 'urql'
import fetchTrackQuery from '@hylo/graphql/queries/fetchTrackQuery'

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

  return [data?.track, { fetching, error }, reQuery]
} 