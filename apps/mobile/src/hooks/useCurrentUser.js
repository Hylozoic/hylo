import { useQuery } from 'urql'
import meQuery from 'graphql/queries/meQuery'

export default function useCurrentUser () {
  const [{ data, fetching, error }, reQuery] = useQuery({ query: meQuery })

  if (error) {
    console.log('!!! URQL error when trying to retrieve currentUser:', error)
    return null
  }

  return [data?.me, { fetching, error }, reQuery]
}
