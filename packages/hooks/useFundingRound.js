import { useMemo } from 'react'
import { useQuery } from 'urql'
import fetchFundingRoundQuery from '@hylo/graphql/queries/fetchFundingRoundQuery'

// Helper to present funding round data
function presentFundingRound (fundingRound) {
  if (!fundingRound) return null
  return {
    ...fundingRound,
    users: fundingRound.users?.items || [],
    submissions: fundingRound.submissions?.items || []
  }
}

export default function useFundingRound ({ fundingRoundId }, useQueryArgs = {}) {
  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: fetchFundingRoundQuery,
    variables: {
      id: fundingRoundId
    },
    pause: !fundingRoundId
  })

  const fundingRound = useMemo(() => {
    return presentFundingRound(data?.fundingRound)
  }, [data?.fundingRound])

  if (error) {
    console.log('!!! URQL error when trying to retrieve funding round:', error)
    return [null, { fetching, error }, reQuery]
  }

  return [fundingRound, { fetching, error }, reQuery]
}
