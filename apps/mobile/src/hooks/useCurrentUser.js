import { useQuery } from 'urql'
import meQuery from 'graphql/queries/meQuery'

export default function useCurrentUser (useQueryArgs = {}) {
  const [{ data, fetching, error }, reQuery] = useQuery({ ...useQueryArgs, query: meQuery })

  if (error) {
    console.log('!!! URQL error when trying to retrieve currentUser:', error)
    return null
  }

  return [data?.me, { fetching, error }, reQuery]
}
