import { useMemo } from 'react'
import { useQuery } from 'urql'
import groupDetailsQueryMaker from '@hylo/graphql/queries/groupDetailsQueryMaker'
import GroupPresenter, { getStaticContext, isStaticContext } from '@hylo/presenters/GroupPresenter'
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
  const isStatic = isStaticContext(groupSlug || groupId)
  const [{ currentUser, ...currentUserRest }] = useCurrentUser({
    pause: !isStatic || useQueryArgs?.pause || !groupSlug
  })

  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupDetailsQueryMaker(groupQueryScope),
    variables: { id: groupId, slug: groupSlug },
    pause: isStatic || useQueryArgs?.pause || (!groupSlug && !groupId)
  })

  if (isStatic) {
    const group = getStaticContext(groupSlug || groupId, { currentUser })
    return [{ group, ...currentUserRest }, () => {}]
  }

  const group = useMemo(() => GroupPresenter(data?.group), [data?.group])

  return [{ group, fetching, error }, reQuery]
}
