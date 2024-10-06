import { useQuery } from 'urql'
import MeQuery from 'graphql/queries/MeQuery'

export default function useCurrentUser () {
  const [{ data, error }] = useQuery({ query: MeQuery })

  if (error) {
    console.log('!!! URQL error when trying to retrieve currentUser from cache:', error)
    return null
  }

  return data?.me
}
