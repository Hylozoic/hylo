import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import HyloHTML from 'components/HyloHTML'
import Loading from 'components/Loading'
import RoundPhaseStatus from 'routes/FundingRoundSubmissionsView/RoundPhaseStatus'
import { getRoundPhaseMeta } from 'routes/FundingRoundSubmissionsView/phaseUtils'
import { fetchFundingRound, FETCH_FUNDING_ROUND } from 'routes/FundingRounds/FundingRounds.store'
import { formatUserDatePair } from 'util/dateFormat'
import getFundingRound from 'store/selectors/getFundingRound'
import getMe from 'store/selectors/getMe'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import isPendingFor from 'store/selectors/isPendingFor'

/** Small labeled info cell for funding round settings. */
function Info ({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className='border border-foreground/20 rounded-lg p-3'>
      <div className='text-xs text-foreground/60 uppercase'>{label}</div>
      <div className='text-base'>{value}</div>
    </div>
  )
}

/** Role chips for submitter/voter restrictions, or "Any member" when unrestricted. */
function RoleList ({ roles, t }) {
  if (!roles || roles.length === 0) {
    return <span className='text-sm'>{t('Any member')}</span>
  }
  return (
    <div className='flex flex-wrap gap-1'>
      {roles.map(role => (
        <span key={role.id} className='inline-flex items-center gap-1 px-2 py-1 bg-accent/20 rounded-md text-sm'>
          <span className='text-base'>{role.emoji}</span>
          <span>{role.name}</span>
        </span>
      ))}
    </div>
  )
}

/** Formats a round date for display, or null if unset. */
function formatRoundDate (value) {
  if (!value) return null
  return formatUserDatePair({ start: value })
}

/**
 * Funding round details for About / Welcome pages: current phase, schedule,
 * voting settings, criteria, and who can submit / vote.
 */
export default function FundingRoundAboutInfo ({ fundingRoundId, roleGroupId }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const round = useSelector(state => fundingRoundId ? getFundingRound(state, fundingRoundId) : null)
  const isLoading = useSelector(state => isPendingFor(FETCH_FUNDING_ROUND, state))
  const currentUserRoles = useSelector(state => getRolesForGroup(state, { person: currentUser, groupId: roleGroupId }))

  useEffect(() => {
    if (fundingRoundId) dispatch(fetchFundingRound(fundingRoundId))
  }, [dispatch, fundingRoundId])

  const { currentPhase } = useMemo(() => getRoundPhaseMeta(round || {}), [round])

  const canSubmit = useMemo(() => {
    if (!round?.isParticipating) return false
    if (!round?.submitterRoles?.length) return true
    return currentUserRoles.some(r => round.submitterRoles.map(role => role.id).includes(r.id))
  }, [round?.isParticipating, currentUserRoles, round?.submitterRoles])

  const canVote = useMemo(() => {
    if (!round?.isParticipating) return false
    if (!round?.voterRoles?.length) return true
    return currentUserRoles.some(r => round.voterRoles.map(role => role.id).includes(r.id))
  }, [round?.isParticipating, currentUserRoles, round?.voterRoles])

  if (!fundingRoundId) return null
  if (!round && isLoading) return <Loading />
  if (!round) return null

  const criteriaText = round.criteria
    ? (typeof document !== 'undefined'
        ? new window.DOMParser().parseFromString(round.criteria, 'text/html').body.textContent?.trim()
        : round.criteria.replace(/<[^>]*>/g, '').trim())
    : ''

  const phaseDates = [
    { label: t('Submissions open'), value: formatRoundDate(round.submissionsOpenAt) },
    { label: t('Submissions close'), value: formatRoundDate(round.submissionsCloseAt) },
    { label: t('Voting opens'), value: formatRoundDate(round.votingOpensAt) },
    { label: t('Voting closes'), value: formatRoundDate(round.votingClosesAt) }
  ].filter(item => item.value)

  const votingMethodLabel = round.votingMethod === 'token_allocation_constant'
    ? t('Equal Token Allocation')
    : t('Divide Total Tokens Equally')

  const submissionCount = typeof round.numSubmissions === 'number'
    ? round.numSubmissions
    : Array.isArray(round.submissions) ? round.submissions.length : 0

  return (
    <div className='flex flex-col gap-4'>
      <RoundPhaseStatus
        round={round}
        currentPhase={currentPhase}
        submissionCount={submissionCount}
        canSubmit={canSubmit}
        canVote={canVote}
      />

      {phaseDates.length > 0 && (
        <div>
          <h4 className='text-sm font-semibold text-foreground/70 uppercase mb-2'>{t('Schedule')}</h4>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {phaseDates.map(item => (
              <Info key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </div>
      )}

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <Info label={t('Show Budget Field')} value={round.requireBudget ? t('Yes') : t('No')} />
        <Info label={t('Show real-time votes')} value={round.showRealtimeVotes ? t('Yes') : t('No')} />
        <Info label={t('Voting Method')} value={votingMethodLabel} />
        <Info label={t('Token Type')} value={round.tokenType} />
        <Info
          label={round.votingMethod === 'token_allocation_constant' ? t('Tokens per Voter') : t('Total Tokens')}
          value={round.totalTokens}
        />
        {round.minTokenAllocation != null && (
          <Info label={t('Minimum Tokens per Submission')} value={round.minTokenAllocation} />
        )}
        {round.maxTokenAllocation != null && (
          <Info label={t('Maximum Tokens per Submission')} value={round.maxTokenAllocation} />
        )}
      </div>

      {criteriaText && (
        <div>
          <h4 className='text-lg font-semibold mb-1'>{t('Submission Criteria')}</h4>
          <HyloHTML html={round.criteria} />
        </div>
      )}

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div className='border border-foreground/20 rounded-lg p-3'>
          <div className='text-xs text-foreground/60 uppercase mb-2'>{t('Who Can Submit')}</div>
          <RoleList roles={round.submitterRoles} t={t} />
        </div>
        <div className='border border-foreground/20 rounded-lg p-3'>
          <div className='text-xs text-foreground/60 uppercase mb-2'>{t('Who Can Vote')}</div>
          <RoleList roles={round.voterRoles} t={t} />
        </div>
      </div>
    </div>
  )
}
