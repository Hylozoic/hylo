import { useQuery } from 'urql'
import { useMemo } from 'react'
import meQuery from '@hylo/graphql/queries/meQuery'

export default function useCurrentUser (useQueryArgs = {}) {
  const [{ data, fetching, error, stale }, queryCurrentUser] = useQuery({ ...useQueryArgs, query: meQuery })

  // Memoized validation of memberships to ensure group property is always an object
  const validatedCurrentUser = useMemo(() => {
    if (!data?.me) return data?.me

    return {
      ...data.me,
      memberships: data.me.memberships?.map(membership => ({
        ...membership,
        group: membership.group || {}
      }))
    }
  }, [data?.me])

  if (error) {
    console.log('!!! URQL error when trying to retrieve currentUser:', error)
    return null
  }

  return [{ currentUser: validatedCurrentUser, fetching, error, stale }, queryCurrentUser]
}
