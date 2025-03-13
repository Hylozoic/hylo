import { useMemo } from 'react'
import { useQuery } from 'urql'
import groupDetailsQueryMaker from '@hylo/graphql/queries/groupDetailsQueryMaker'
import GroupPresenter, { getStaticContext } from '@hylo/presenters/GroupPresenter'
import useCurrentUser from './useCurrentUser'

export default function useGroup ({
  groupSlug,
  groupId,
  groupQueryScope = {
    withJoinQuestions: true,
    withPrerequisiteGroups: true
  },
  useQueryArgs = {}
} = {}) {
  const [{ currentUser, fetching: userFetching, error: userError }] = useCurrentUser({ pause: useQueryArgs?.pause || !groupSlug })
  const contextGroup = useMemo(() => getStaticContext(groupSlug || groupId, { currentUser }), [groupSlug, groupId, currentUser])

  const [{ data, fetching: groupFetching, error: groupError }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupDetailsQueryMaker(groupQueryScope),
    variables: { id: groupId, slug: groupSlug },
    pause: !!contextGroup || useQueryArgs?.pause || (!groupSlug && !groupId)
  })

  const group = useMemo(() => (
    contextGroup || GroupPresenter(data?.group, { currentUser })
  ), [contextGroup, data?.group, currentUser])

  return [{
    group,
    fetching: userFetching || groupFetching,
    error: groupError || userError
  }, contextGroup ? () => {} : reQuery]
}
