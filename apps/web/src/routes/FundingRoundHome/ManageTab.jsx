import { Settings, ChevronsRight } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { DateTimeHelpers } from '@hylo/shared'
import { groupUrl } from '@hylo/navigation'
import Button from 'components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'components/ui/dialog'
import useRouteParams from 'hooks/useRouteParams'
import { updateFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import { cn } from 'util/index'
import { getLocaleFromLocalStorage } from 'util/locale'

export default function ManageTab ({ round }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const navigate = useNavigate()
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    onConfirm: null
  })

  const [errorDialog, setErrorDialog] = useState({
    isOpen: false,
    title: '',
    message: ''
  })

  const now = new Date()
  const submissionsOpenAt = round.submissionsOpenAt ? DateTimeHelpers.toDateTime(round.submissionsOpenAt, { locale: getLocaleFromLocalStorage() }) : null
  const submissionsCloseAt = round.submissionsCloseAt ? DateTimeHelpers.toDateTime(round.submissionsCloseAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingOpensAt = round.votingOpensAt ? DateTimeHelpers.toDateTime(round.votingOpensAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingClosesAt = round.votingClosesAt ? DateTimeHelpers.toDateTime(round.votingClosesAt, { locale: getLocaleFromLocalStorage() }) : null

  // Determine current phase
  let currentPhase = 'not-begun'
  if (round.votingClosesAt && votingClosesAt <= now) {
    currentPhase = 'completed'
  } else if (round.votingOpensAt && votingOpensAt <= now) {
    currentPhase = 'voting'
  } else if (round.submissionsCloseAt && submissionsCloseAt <= now) {
    currentPhase = 'discussion'
  } else if (round.submissionsOpenAt && submissionsOpenAt <= now) {
    currentPhase = 'submissions'
  } else if (round.publishedAt && round.publishedAt <= now) {
    currentPhase = 'not-begun'
  }

  // Helper function to get status-aware phase data
  const getPhaseData = (phaseKey, baseLabel, baseDescription, dateField, forwardButtonText, backButtonText, backDateField) => {
    const isCurrent = currentPhase === phaseKey
    const isPast = getIsPast(phaseKey)
    const isFuture = !isCurrent && !isPast

    let label = baseLabel
    let description = baseDescription
    let endDate = null

    if (isPast) {
      // Completed phases - show completion status
      switch (phaseKey) {
        case 'not-begun':
          label = t('Round started')
          description = ''
          endDate = submissionsOpenAt
          break
        case 'submissions':
          label = t('Submissions ended', { submissionDescriptorPlural: round.submissionDescriptorPlural || t('Submissions') })
          description = t('{{numSubmissions}} {{submissionDescriptorPlural}} received', {
            numSubmissions: round.numSubmissions || 0,
            submissionDescriptorPlural: (round.submissionDescriptorPlural || t('submissions')).toLowerCase()
          })
          endDate = submissionsCloseAt
          break
        case 'discussion':
          label = t('Discussion ended')
          description = t('Discussion phase completed')
          endDate = votingOpensAt
          break
        case 'voting':
          label = t('Voting ended')
          description = t('Voting phase completed')
          endDate = votingClosesAt
          break
      }
    } else if (isFuture) {
      // Future phases - show scheduling status
      switch (phaseKey) {
        case 'submissions':
          label = t('Submission phase', { submissionDescriptorPlural: round.submissionDescriptorPlural || t('Submissions') })
          description = t('When submissions open, members can offer their {{submissionDescriptorPlural}}', { submissionDescriptorPlural: (round.submissionDescriptorPlural || t('Submissions')).toLowerCase() })
          endDate = submissionsOpenAt
          break
        case 'discussion':
          label = t('Discussion phase')
          description = t('When discussion begins, members can discuss {{submissionDescriptorPlural}} and make modifications based on feedback', { submissionDescriptorPlural: (round.submissionDescriptorPlural || t('submissions')).toLowerCase() })
          endDate = submissionsCloseAt
          break
        case 'voting':
          label = t('Voting phase')
          description = t('When voting opens, members can vote and discuss {{submissionDescriptorPlural}}', { submissionDescriptorPlural: (round.submissionDescriptorPlural || t('proposals')).toLowerCase() })
          endDate = votingOpensAt
          break
        case 'completed':
          label = t('Round completion')
          description = t('When the round completes, results will be available')
          endDate = votingClosesAt
          break
      }
    }

    // Determine if phase is scheduled based on whether it has a date
    let isScheduled = false
    if (phaseKey === 'submissions') {
      isScheduled = !!submissionsOpenAt
    } else if (phaseKey === 'discussion') {
      isScheduled = !!submissionsCloseAt
    } else if (phaseKey === 'voting') {
      isScheduled = !!votingOpensAt
    } else if (phaseKey === 'completed') {
      isScheduled = !!votingClosesAt
    }

    return {
      key: phaseKey,
      label,
      description,
      isCurrent,
      isPast,
      isFuture,
      isScheduled,
      endDate,
      dateField,
      forwardButtonText: isCurrent ? forwardButtonText : null,
      backButtonText: isCurrent ? backButtonText : null,
      backDateField
    }
  }

  // Helper function to determine if a phase is past
  const getIsPast = (phaseKey) => {
    switch (phaseKey) {
      case 'not-begun':
        return currentPhase !== 'not-begun'
      case 'submissions':
        return currentPhase === 'discussion' || currentPhase === 'voting' || currentPhase === 'completed'
      case 'discussion':
        return currentPhase === 'voting' || currentPhase === 'completed'
      case 'voting':
        return currentPhase === 'completed'
      case 'completed':
        return false
      default:
        return false
    }
  }

  // Define the 5 phases with status-aware data
  const submissionDescriptorPlural = round.submissionDescriptorPlural || t('Submissions')
  const submissionDescriptor = round.submissionDescriptor || t('Submission')

  const phases = [
    getPhaseData('not-begun', t('Round has not begun'), t('The funding round is ready to start'), 'submissionsOpenAt', t('Open submissions', { submissionDescriptorPlural }), null, null),
    getPhaseData('submissions', t('Submission Phase', { submissionDescriptor }), t('Members can offer their {{submissionDescriptorPlural}}', { submissionDescriptorPlural: submissionDescriptorPlural.toLowerCase() }), 'submissionsCloseAt', t('End submissions & Begin discussion', { submissionDescriptorPlural: submissionDescriptorPlural.toLowerCase() }), t('Pause submissions', { submissionDescriptorPlural }), 'submissionsOpenAt'),
    getPhaseData('discussion', t('Discussion Phase'), t('Members can discuss {{submissionDescriptorPlural}} and make modifications based on feedback', { submissionDescriptorPlural: submissionDescriptorPlural.toLowerCase() }), 'votingOpensAt', t('End discussion & begin voting'), t('Reopen {{submissionDescriptorPlural}}', { submissionDescriptorPlural }), 'submissionsCloseAt'),
    getPhaseData('voting', t('Voting Phase'), t('Members can vote and discuss {{submissionDescriptorPlural}}', { submissionDescriptorPlural: submissionDescriptorPlural.toLowerCase() }), 'votingClosesAt', t('End Voting'), t('Re-open discussion'), 'votingOpensAt'),
    getPhaseData('completed', t('Round complete'), t('Congratulations! {{numParticipants}} participants contributed {{numSubmissions}} {{submissionDescriptorPlural}}! View the {{submissionDescriptorPlural}} page to see the outcome.', {
      numParticipants: round.numParticipants || 0,
      numSubmissions: round.numSubmissions || 0,
      submissionDescriptorPlural: submissionDescriptorPlural.toLowerCase()
    }), null, null, null, null)
  ]

  const handleStartPhase = (phaseLabel, dateField, buttonText) => {
    setConfirmDialog({
      isOpen: true,
      title: t('Confirm Action'),
      message: t('Are you sure you want to {{action}}?', { action: buttonText.toLowerCase() }),
      confirmButtonText: buttonText,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', confirmButtonText: '', onConfirm: null })
        try {
          await dispatch(updateFundingRound({ id: round.id, [dateField]: new Date().toISOString() }))
        } catch (error) {
          const errorMessage = error?.message || error?.toString() || t('An error occurred while updating the funding round')
          setErrorDialog({
            isOpen: true,
            title: t('Error'),
            message: errorMessage
          })
        }
      }
    })
  }

  const handleGoBackPhase = (phaseLabel, dateField, buttonText) => {
    // Going back means clearing the date to go back to the previous phase
    let confirmMessage = t('Are you sure you want to {{action}}?', { action: buttonText.toLowerCase() })

    // If going back from voting phase to discussion, warn about token reset
    if (dateField === 'votingOpensAt' && round.tokensDistributedAt) {
      confirmMessage = t('This will reset all token allocations. Are you sure you want to {{action}}?', { action: buttonText.toLowerCase() })
    }

    setConfirmDialog({
      isOpen: true,
      title: t('Confirm Action'),
      message: confirmMessage,
      confirmButtonText: buttonText,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', confirmButtonText: '', onConfirm: null })
        try {
          await dispatch(updateFundingRound({ id: round.id, [dateField]: null }))
        } catch (error) {
          const errorMessage = error?.message || error?.toString() || t('An error occurred while updating the funding round')
          setErrorDialog({
            isOpen: true,
            title: t('Error'),
            message: errorMessage
          })
        }
      }
    })
  }

  const handleCancelConfirm = () => {
    setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
  }

  const handleConfirm = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm()
    }
  }

  const handleCloseError = () => {
    setErrorDialog({ isOpen: false, title: '', message: '' })
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

      <div className='border-2 border-foreground/20 rounded-lg p-4'>
        <h3 className='text-sm opacity-50 w-full text-center mb-3'>{t('Round Timeline')}</h3>
        <div className='flex flex-col gap-3'>
          {phases.map((phase, index) => {
            // Show forward button for current phase if it has a forward action
            // Show back button for current phase if it has a back action
            const showForwardButton = phase.isCurrent && phase.forwardButtonText
            const showBackButton = phase.isCurrent && phase.backButtonText

            return (
              <div
                key={phase.key}
                className={cn(
                  'flex flex-col items-start justify-between border-2 p-4 rounded-md',
                  phase.isCurrent
                    ? 'border-selected bg-selected/10 shadow-md'
                    : phase.isPast || phase.isFuture
                      ? 'border-foreground/10 bg-foreground/5 opacity-50'
                      : 'border-foreground/20'
                )}
              >
                <div className='flex flex-col gap-1 flex-1'>
                  <div className='font-medium text-lg text-foreground flex items-center gap-2 flex-wrap'>
                    {phase.label}
                    {phase.isCurrent && phase.key !== 'not-begun' && (
                      <span className='px-2 py-0.5 text-xs text-foreground bg-selected rounded-full font-medium'>
                        {t('Current')}
                      </span>
                    )}
                    {phase.isFuture && !phase.isScheduled && (
                      <span className='px-2 py-0.5 text-xs text-foreground bg-foreground/20 rounded-full font-medium'>
                        {t('Not scheduled')}
                      </span>
                    )}
                    {phase.key === 'completed' && phase.isCurrent && (
                      <span className='px-2 py-0.5 text-xs text-foreground bg-foreground/20 rounded-full font-medium'>
                        {t('Complete')}
                      </span>
                    )}
                    {phase.endDate && (
                      <span className='px-2 py-0.5 text-xs text-foreground bg-foreground/20 rounded-full font-medium'>
                        {phase.endDate.toFormat('ccc MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  <div>
                    {phase.description}
                  </div>
                </div>
                <div className='flex gap-2 w-full items-center justify-center'>
                  {showBackButton && (
                    <Button
                      size='sm'
                      className='bg-transparent border-2 border-foreground/20 hover:border-foreground/40 text-foreground mt-4 mb-2'
                      onClick={() => handleGoBackPhase(phase.label, phase.backDateField, phase.backButtonText)}
                    >
                      {phase.backButtonText}
                    </Button>
                  )}
                  {showForwardButton && (
                    <Button
                      size='sm'
                      className='bg-selected hover:bg-selected/90 text-foreground border-2 border-transparent mt-4 mb-2'
                      onClick={() => handleStartPhase(phase.label, phase.dateField, phase.forwardButtonText)}
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

      <Dialog open={confirmDialog.isOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>
              {confirmDialog.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={handleCancelConfirm}
            >
              {t('Cancel')}
            </Button>
            <Button
              className='bg-selected hover:bg-selected/90 text-foreground'
              onClick={handleConfirm}
            >
              {confirmDialog.confirmButtonText || t('Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorDialog.isOpen} onOpenChange={handleCloseError}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className='text-destructive'>{errorDialog.title}</DialogTitle>
            <DialogDescription>
              {errorDialog.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className='bg-selected hover:bg-selected/90 text-foreground'
              onClick={handleCloseError}
            >
              {t('OK')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
