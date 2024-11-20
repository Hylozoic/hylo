import { useQuery } from 'urql'
import personQuery from 'graphql/queries/personQuery'

export default function usePerson ({ id }) {
  const [{ data, fetching, error }] = useQuery({ query: personQuery, variables: { id } })

  if (error) {
    console.log('!!! URQL error when trying to retrieve person:', error)
    return null
  }

  return [data?.person, { fetching, error }]
}
