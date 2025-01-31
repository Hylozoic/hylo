import { useQuery } from 'urql'
import personQuery from '@hylo/graphql/queries/personQuery'

export default function usePerson ({ id }, useQueryArgs = {}) {
  const [{ data, fetching, error }, reQuery] = useQuery({ ...useQueryArgs, query: personQuery, variables: { id } })

  if (error) {
    console.log('!!! URQL error when trying to retrieve person:', error)
    return null
  }

  return [data?.person, { fetching, error }, reQuery]
}
