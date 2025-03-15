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
  const staticGroup = useMemo(
    () => getStaticContext(groupSlug || groupId, currentUser),
    [groupId, groupSlug, currentUser]
  )

  const [{ data, ...groupReset }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupDetailsQueryMaker(groupQueryScope),
    variables: { id: groupId, slug: groupSlug },
    pause: isStatic || useQueryArgs?.pause || (!groupSlug && !groupId)
  })
  const group = useMemo(
    () => GroupPresenter(data?.group), [data?.group],
    [data?.group]
  )

  if (isStatic) {
    return [{ group: staticGroup, ...currentUserRest }, () => {}]
  }

  return [{ group, ...groupReset }, reQuery]
}
