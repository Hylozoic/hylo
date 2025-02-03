import { useQuery } from 'urql'
import meQuery from '@hylo/graphql/queries/meQuery'

export default function useCurrentUser (useQueryArgs = {}) {
  const [{ data, fetching, error, stale }, queryCurrentUser] = useQuery({
    ...useQueryArgs,
    query: meQuery
  })

  if (error) {
    console.log('!!! URQL error when trying to retrieve currentUser:', error)
    return null
  }

  return [{ currentUser: data?.me, fetching, error, stale }, queryCurrentUser]
}
