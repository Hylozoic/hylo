import { useQuery } from 'urql'
import groupTracksQuery from '@hylo/graphql/queries/groupTracksQuery'

export default function useTracks ({ groupId, groupSlug }, useQueryArgs = {}) {
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

  // The tracks are nested under group in the response
  const tracks = data?.group?.tracks?.items || []

  return [tracks, { fetching, error }, reQuery]
}
