import { useMemo } from 'react'
import { useQuery } from 'urql'
import groupFundingRoundsQuery from '@hylo/graphql/queries/groupFundingRoundsQuery'

// Helper to present funding round data
function presentFundingRound (fundingRound) {
  if (!fundingRound) return null
  return {
    ...fundingRound,
    users: fundingRound.users?.items || []
  }
}

export default function useFundingRounds ({
  groupId,
  groupSlug,
  hideUnpublished = false
}, useQueryArgs = {}) {
  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupFundingRoundsQuery,
    variables: {
      id: groupId,
      published: hideUnpublished ? true : undefined,
      first: 100,
      sortBy: 'created_at',
      order: 'desc'
    },
    pause: !groupId && !groupSlug
  })

  const fundingRounds = useMemo(() => {
    if (!data?.group?.fundingRounds?.items) return []
    return data.group.fundingRounds.items.map(presentFundingRound)
  }, [data?.group?.fundingRounds?.items])

  return [fundingRounds, { fetching, error }, reQuery]
}
