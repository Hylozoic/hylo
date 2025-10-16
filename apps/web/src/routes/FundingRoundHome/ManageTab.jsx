import { Settings, ChevronsRight } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { DateTimeHelpers } from '@hylo/shared'
import { groupUrl } from '@hylo/navigation'
import Button from 'components/ui/button'
import useRouteParams from 'hooks/useRouteParams'
import { updateFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import { cn } from 'util/index'
import { getLocaleFromLocalStorage } from 'util/locale'

export default function ManageTab ({ round }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const navigate = useNavigate()

  const now = new Date()
  const submissionsOpenAt = round.submissionsOpenAt ? DateTimeHelpers.toDateTime(round.submissionsOpenAt, { locale: getLocaleFromLocalStorage() }) : null
  const submissionsCloseAt = round.submissionsCloseAt ? DateTimeHelpers.toDateTime(round.submissionsCloseAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingOpensAt = round.votingOpensAt ? DateTimeHelpers.toDateTime(round.votingOpensAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingClosesAt = round.votingClosesAt ? DateTimeHelpers.toDateTime(round.votingClosesAt, { locale: getLocaleFromLocalStorage() }) : null

  // Determine current phase
  let currentPhase = 'draft'
  if (round.votingClosesAt && votingClosesAt <= now) {
    currentPhase = 'completed'
  } else if (round.votingOpensAt && votingOpensAt <= now) {
    currentPhase = 'voting'
  } else if (round.submissionsCloseAt && submissionsCloseAt <= now) {
    currentPhase = 'discussion'
  } else if (round.submissionsOpenAt && submissionsOpenAt <= now) {
    currentPhase = 'submissions'
  } else if (round.publishedAt && round.publishedAt <= now) {
    currentPhase = 'open'
  }

  // Determine next phase and prepare data
  const phases = []
  let currentPhaseIndex = -1

  // Always show all phases, even if dates aren't set
  const isPastSubmissionsOpen = submissionsOpenAt && submissionsOpenAt <= now
  const isCurrentSubmissionsOpen = currentPhase === 'submissions'
  phases.push({
    key: 'submissionsOpen',
    label: isPastSubmissionsOpen ? t('Submissions opened') : t('Submissions open'),
    date: submissionsOpenAt,
    isPast: isPastSubmissionsOpen,
    isCurrent: isCurrentSubmissionsOpen,
    dateField: 'submissionsOpenAt',
    forwardButtonText: t('Open Now'),
    backButtonText: t('Pause Submissions'),
    backDateField: 'submissionsOpenAt'
  })
  if (isCurrentSubmissionsOpen) currentPhaseIndex = phases.length - 1

  const isPastSubmissionsClose = submissionsCloseAt && submissionsCloseAt <= now
  const isCurrentSubmissionsClose = currentPhase === 'discussion'
  phases.push({
    key: 'submissionsClose',
    label: isPastSubmissionsClose ? t('Submissions closed / Discussion open') : t('Submissions close / Discussion open'),
    date: submissionsCloseAt,
    isPast: isPastSubmissionsClose,
    isCurrent: isCurrentSubmissionsClose,
    dateField: 'submissionsCloseAt',
    forwardButtonText: t('Close Now'),
    backButtonText: t('Re-open Submissions'),
    backDateField: 'submissionsCloseAt'
  })
  if (isCurrentSubmissionsClose) currentPhaseIndex = phases.length - 1

  const isPastVotingOpens = votingOpensAt && votingOpensAt <= now
  const isCurrentVotingOpens = currentPhase === 'voting'
  phases.push({
    key: 'votingOpens',
    label: isPastVotingOpens ? t('Voting opened') : t('Voting opens'),
    date: votingOpensAt,
    isPast: isPastVotingOpens,
    isCurrent: isCurrentVotingOpens,
    dateField: 'votingOpensAt',
    forwardButtonText: t('Open Now'),
    backButtonText: t('Pause Voting'),
    backDateField: 'votingOpensAt'
  })
  if (isCurrentVotingOpens) currentPhaseIndex = phases.length - 1

  const isPastVotingCloses = votingClosesAt && votingClosesAt <= now
  const isCurrentVotingCloses = currentPhase === 'completed'
  phases.push({
    key: 'votingCloses',
    label: isPastVotingCloses ? t('Voting closed') : t('Voting closes'),
    date: votingClosesAt,
    isPast: isPastVotingCloses,
    isCurrent: isCurrentVotingCloses,
    dateField: 'votingClosesAt',
    forwardButtonText: t('Close Now'),
    backButtonText: t('Re-open Voting'),
    backDateField: 'votingClosesAt'
  })
  if (isCurrentVotingCloses) currentPhaseIndex = phases.length - 1

  const handleStartPhase = (phaseLabel, dateField) => {
    if (confirm(t('fundingRound.manuallyStartPhase', { phaseLabel }))) {
      dispatch(updateFundingRound({ id: round.id, [dateField]: new Date().toISOString() }))
    }
  }

  const handleGoBackPhase = (phaseLabel, dateField) => {
    // Going back means clearing the date to go back to the previous phase
    let confirmMessage = t('fundingRound.goBackPhase', { phaseLabel })

    // If going back from voting phase to discussion, warn about token reset
    if (dateField === 'votingOpensAt' && round.tokensDistributedAt) {
      confirmMessage = t('This will reset all token allocations. Are you sure you want to go back to the discussion phase?')
    }

    if (confirm(confirmMessage)) {
      dispatch(updateFundingRound({ id: round.id, [dateField]: null }))
    }
  }

  return (
    <div className='flex flex-col gap-4 mt-4'>
      <button
        className='w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md flex flex-row items-center gap-2 justify-center'
        onClick={() => navigate(groupUrl(routeParams.groupSlug, `funding-rounds/${round?.id}/edit`))}
      >
        <Settings className='w-4 h-4' />
        <span>{t('Edit Funding Round')}</span>
      </button>

      <div className='border border-foreground/20 rounded-lg p-4'>
        <h3 className='text-lg font-semibold mb-3'>{t('Phase Timeline')}</h3>
        <div className='flex flex-col gap-3'>
          {phases.map((phase, index) => {
            // If we're before any phase started, show button for first phase
            // Otherwise, show button only for the phase immediately after current
            const isNextPhase = currentPhaseIndex === -1
              ? index === 0
              : currentPhaseIndex >= 0 && index === currentPhaseIndex + 1
            const showForwardButton = !phase.isPast && !phase.isCurrent && isNextPhase
            const showBackButton = phase.isCurrent

            return (
              <div
                key={phase.key}
                className={cn(
                  'flex flex-row items-center justify-between p-3 rounded-md border',
                  phase.isCurrent
                    ? 'border-selected bg-selected/10 shadow-md'
                    : phase.isPast
                      ? 'border-foreground/10 bg-foreground/5'
                      : 'border-foreground/20'
                )}
              >
                <div className='flex flex-col gap-1'>
                  <div className='font-medium'>
                    {phase.label}
                    {phase.isCurrent && (
                      <span className='ml-2 text-xs text-selected font-bold'>({t('current')})</span>
                    )}
                  </div>
                  <div className='text-sm text-foreground/60'>
                    {phase.date ? DateTimeHelpers.formatDatePair({ start: phase.date }) : t('Not scheduled')}
                  </div>
                </div>
                <div className='flex gap-2'>
                  {showBackButton && (
                    <Button
                      variant='secondary'
                      size='sm'
                      onClick={() => handleGoBackPhase(phase.label, phase.backDateField)}
                    >
                      {phase.backButtonText}
                    </Button>
                  )}
                  {showForwardButton && (
                    <Button
                      variant='default'
                      size='sm'
                      onClick={() => handleStartPhase(phase.label, phase.dateField)}
                    >
                      <ChevronsRight className='w-4 h-4 mr-1' />
                      {phase.forwardButtonText}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
