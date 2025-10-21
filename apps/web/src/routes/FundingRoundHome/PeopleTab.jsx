import React from 'react'
import { useTranslation } from 'react-i18next'
import { personUrl } from '@hylo/navigation'
import { Link } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'
import { CircleDashed } from 'lucide-react'
import RoundPhaseStatus from './RoundPhaseStatus'
import { getRoundPhaseMeta } from './phaseUtils'

// Check if a user has any of the required roles
function userHasRole (user, requiredRoles, groupId) {
  if (!requiredRoles || requiredRoles.length === 0) return true

  for (const requiredRole of requiredRoles) {
    if (requiredRole.type === 'common') {
      // Check if user has this common role for this group
      const hasCommonRole = user.membershipCommonRoles?.items?.some(
        mcr => mcr.commonRoleId === requiredRole.id && mcr.groupId === groupId
      )
      if (hasCommonRole) return true
    } else {
      // Check if user has this group role
      const hasGroupRole = user.groupRoles?.items?.some(
        gr => gr.id === requiredRole.id && gr.groupId === groupId && gr.active
      )
      if (hasGroupRole) return true
    }
  }

  return false
}

export default function PeopleTab ({ group, round }) {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const { users, submitterRoles, voterRoles } = round
  const groupId = group?.id
  const { currentPhase } = getRoundPhaseMeta(round)
  const submissionCount = typeof round.numSubmissions === 'number'
    ? round.numSubmissions
    : Array.isArray(round.submissions) ? round.submissions.length : 0

  return (
    <div className='flex flex-col gap-4'>
      <RoundPhaseStatus
        round={round}
        currentPhase={currentPhase}
        submissionCount={submissionCount}
      />
      {users?.length === 0 && (
        <div className='flex flex-col gap-2 pt-4 items-center justify-center border-2 border-foreground/20 rounded-md border-dashed p-4 mt-4'>
          <CircleDashed className='w-12 h-12 text-foreground/80' />
          <h1 className='text-lg font-bold text-foreground/80 mb-0 mt-0'>{t('No one has joined this round')}</h1>
          <p className='text-sm text-foreground/50'>{t('Let your group members know about this round and encourage them to join')}</p>
        </div>
      )}
      {users?.length > 0 && (
        <div className='flex flex-col gap-2 pt-4'>
          {users?.map(user => {
            const canSubmit = userHasRole(user, submitterRoles, groupId)
            const canVote = userHasRole(user, voterRoles, groupId)
            const isViewer = !canSubmit && !canVote

            return (
              <div key={user.id} className='flex flex-row gap-2 items-center justify-between'>
                <div>
                  <Link to={personUrl(user.id, routeParams.groupSlug)} className='flex flex-row gap-2 items-center text-foreground'>
                    <img src={user.avatarUrl} alt={user.name} className='w-10 h-10 rounded-full my-2' />
                    <span>{user.name}</span>
                  </Link>
                </div>
                <div className='flex flex-row gap-4 items-center text-xs text-foreground/60'>
                  {canSubmit && (
                    <div className='px-2 py-1 bg-selected/20 rounded-md'>
                      <span>{t('Can Submit')}</span>
                    </div>
                  )}
                  {canVote && (
                    <div className='px-2 py-1 bg-selected/20 rounded-md'>
                      <span>{t('Can Vote')}</span>
                    </div>
                  )}
                  {isViewer && (
                    <div className='px-2 py-1 bg-foreground/10 rounded-md'>
                      <span>{t('Viewer')}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
