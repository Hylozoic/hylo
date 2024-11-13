import { useQuery } from 'urql'
import meQuery from 'graphql/queries/meQuery'

export default function useCurrentUser () {
  const [{ data, error }] = useQuery({ query: meQuery })

  if (error) {
    console.log('!!! URQL error when trying to retrieve currentUser from cache:', error)
    return null
  }

  return data?.me
}
