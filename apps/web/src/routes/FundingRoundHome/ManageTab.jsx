import { Settings, ChevronsRight, Download, Trash2 } from 'lucide-react'
import React, { useCallback, useState, useMemo } from 'react'
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
import { updateFundingRound, deleteFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import fetchFundingRoundAllocations from 'store/actions/fetchFundingRoundAllocations'
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
  const [isExporting, setIsExporting] = useState(false)

  const submissionsOpenAt = round.submissionsOpenAt ? DateTimeHelpers.toDateTime(round.submissionsOpenAt, { locale: getLocaleFromLocalStorage() }) : null
  const submissionsCloseAt = round.submissionsCloseAt ? DateTimeHelpers.toDateTime(round.submissionsCloseAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingOpensAt = round.votingOpensAt ? DateTimeHelpers.toDateTime(round.votingOpensAt, { locale: getLocaleFromLocalStorage() }) : null
  const votingClosesAt = round.votingClosesAt ? DateTimeHelpers.toDateTime(round.votingClosesAt, { locale: getLocaleFromLocalStorage() }) : null

  // Determine current phase
  const currentPhase = round.phase

  // Helper function to get status-aware phase data
  const getPhaseData = useCallback(({ phaseKey, baseLabel, baseDescription, dateField, forwardButtonText, backButtonText, backDateField, nextPhaseKey, previousPhaseKey }) => {
    const isCurrent = currentPhase === phaseKey
    const isPast = getIsPast(phaseKey)
    const isFuture = !isCurrent && !isPast

    let label = baseLabel
    let description = baseDescription
    let endDate = null

    if (isPast) {
      // Completed phases - show completion status
      switch (phaseKey) {
        case 'published':
          label = t('Round started')
          description = ''
          endDate = submissionsOpenAt
          break
        case 'submissions':
          label = t('Submissions ended', { submissionDescriptorPlural: round.submissionDescriptorPlural || t('Submissions') })
          description = t('{{numSubmissions}} {{submissionDescriptorPlural}} received', {
            numSubmissions: round.numSubmissions || 0,
            submissionDescriptorPlural: (round.submissionDescriptorPlural || t('Submissions')).toLowerCase()
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
          label = t('Submission phase')
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
      backButtonText: isCurrent ? backButtonText : null,
      backDateField,
      dateField,
      description,
      endDate,
      forwardButtonText: isCurrent ? forwardButtonText : null,
      isCurrent,
      isFuture,
      isPast,
      isScheduled,
      key: phaseKey,
      label,
      nextPhaseKey,
      previousPhaseKey
    }
  }, [currentPhase, submissionsOpenAt, submissionsCloseAt, votingOpensAt, votingClosesAt])

  // Helper function to determine if a phase is past
  const getIsPast = (phaseKey) => {
    switch (phaseKey) {
      case 'published':
        return currentPhase !== 'published'
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

  const phases = useMemo(() => [
    getPhaseData({
      phaseKey: 'published',
      baseLabel: t('Round has not begun'),
      baseDescription: t('The funding round is ready to start'),
      dateField: 'submissionsOpenAt',
      forwardButtonText: t('Open submissions'),
      nextPhaseKey: 'submissions',
      previousPhaseKey: null
    }),
    getPhaseData({
      phaseKey: 'submissions',
      baseLabel: t('Submission Phase'),
      baseDescription: t('Members can offer their {{submissionDescriptorPlural}}', { submissionDescriptorPlural: submissionDescriptorPlural.toLowerCase() }),
      dateField: 'submissionsCloseAt',
      forwardButtonText: t('End submissions & Begin discussion'),
      backButtonText: t('Pause submissions'),
      backDateField: 'submissionsOpenAt',
      nextPhaseKey: 'discussion',
      previousPhaseKey: 'published'
    }),
    getPhaseData({
      phaseKey: 'discussion',
      baseLabel: t('Discussion Phase'),
      baseDescription: t('Members can discuss {{submissionDescriptorPlural}} and make modifications based on feedback', { submissionDescriptorPlural: submissionDescriptorPlural.toLowerCase() }),
      dateField: 'votingOpensAt',
      forwardButtonText: t('End discussion & begin voting'),
      backButtonText: t('Reopen {{submissionDescriptorPlural}}', { submissionDescriptorPlural }),
      backDateField: 'submissionsCloseAt',
      nextPhaseKey: 'voting',
      previousPhaseKey: 'submissions'
    }),
    getPhaseData({
      phaseKey: 'voting',
      baseLabel: t('Voting Phase'),
      baseDescription: t('Members can vote and discuss {{submissionDescriptorPlural}}', { submissionDescriptorPlural: submissionDescriptorPlural.toLowerCase() }),
      dateField: 'votingClosesAt',
      forwardButtonText: t('End Voting'),
      backButtonText: t('Re-open Discussion'),
      backDateField: 'votingOpensAt',
      nextPhaseKey: 'completed',
      previousPhaseKey: 'discussion'
    }),
    getPhaseData({
      phaseKey: 'completed',
      baseLabel: t('Round complete!'),
      baseDescription: t('Congratulations! {{numParticipants}} participants contributed {{numSubmissions}} {{submissionDescriptorPlural}}! View the {{submissionDescriptorPlural}} page to see the outcome.', { numParticipants: round.numParticipants || 0, numSubmissions: round.numSubmissions || 0, submissionDescriptorPlural: submissionDescriptorPlural.toLowerCase() }),
      dateField: null,
      forwardButtonText: null,
      backButtonText: t('Re-open Voting'),
      backDateField: 'votingClosesAt',
      nextPhaseKey: null,
      previousPhaseKey: 'voting'
    })
  ], [round.phase])

  const handleStartPhase = (phase) => {
    setConfirmDialog({
      isOpen: true,
      title: t('Confirm Action'),
      message: t('Are you sure you want to {{action}}?', { action: phase.forwardButtonText.toLowerCase() }),
      confirmButtonText: phase.forwardButtonText,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', confirmButtonText: '', onConfirm: null })
        try {
          await dispatch(updateFundingRound({ id: round.id, [phase.dateField]: new Date().toISOString(), phase: phase.nextPhaseKey }))
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

  const handleGoBackPhase = (phase) => {
    // Going back means clearing the date to go back to the previous phase
    let confirmMessage = t('Are you sure you want to {{action}}?', { action: phase.backButtonText.toLowerCase() })

    // If going back from voting phase to discussion, warn about token reset
    if (phase.backDateField === 'votingOpensAt' && (round.phase === 'voting' || round.phase === 'completed')) {
      confirmMessage = t('This will reset all token allocations. Are you sure you want to {{action}}?', { action: phase.backButtonText.toLowerCase() })
    }

    setConfirmDialog({
      isOpen: true,
      title: t('Confirm Action'),
      message: confirmMessage,
      confirmButtonText: phase.backButtonText,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', confirmButtonText: '', onConfirm: null })
        try {
          await dispatch(updateFundingRound({ id: round.id, [phase.backDateField]: null, phase: phase.previousPhaseKey }))
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

  const handleDeleteRound = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('Delete Funding Round'),
      message: t('Are you sure you want to delete this funding round? This action cannot be undone. All submissions and votes will be permanently deleted.'),
      confirmButtonText: t('Delete'),
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', confirmButtonText: '', onConfirm: null })
        try {
          await dispatch(deleteFundingRound(round.id))
          navigate(groupUrl(routeParams.groupSlug, 'funding-rounds'))
        } catch (error) {
          const errorMessage = error?.message || error?.toString() || t('An error occurred while deleting the funding round')
          setErrorDialog({
            isOpen: true,
            title: t('Error'),
            message: errorMessage
          })
        }
      }
    })
  }
  const handleExportResults = useCallback(async () => {
    if (isExporting) return

    setIsExporting(true)

    try {
      const response = await dispatch(fetchFundingRoundAllocations(round.id))
      const allocations = response?.payload?.data?.fundingRound?.allocations || []

      const participantMap = new Map()
      const normalizeId = (value) => (value == null ? null : String(value))

      const addParticipant = (user) => {
        if (!user) return null
        const key = normalizeId(user.id)
        if (!key) return null
        if (!participantMap.has(key)) {
          participantMap.set(key, { user, votes: [] })
        }
        return participantMap.get(key)
      }

      (round.users || []).forEach(user => {
        addParticipant(user)
      })

      allocations.forEach(allocation => {
        const participant = addParticipant(allocation?.user)
        if (!participant) return
        const tokens = allocation?.tokensAllocated ?? 0
        if (tokens <= 0) return
        participant.votes.push({
          submission: allocation?.submission || null,
          tokens
        })
      })

      const participants = Array.from(participantMap.values())
      const maxVotes = participants.reduce((max, participant) => Math.max(max, participant.votes.length), 0)

      const header = [t('Participants')]
      for (let index = 1; index <= maxVotes; index++) {
        header.push(`${t('Submission')} ${index}`)
        header.push(`${t('Tokens')} ${index}`)
      }

      const escapeCell = (value) => {
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        return /[",\n]/.test(stringValue)
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue
      }

      const rows = participants
        .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || '', undefined, { sensitivity: 'base' }))
        .map(({ user, votes }) => {
          const row = [user?.name || user?.id || '']
          votes
            .sort((a, b) => b.tokens - a.tokens)
            .forEach(vote => {
              row.push(vote.submission?.title || '')
              row.push(vote.tokens ?? 0)
            })

          while (row.length < header.length) {
            row.push('')
          }

          return row
        })

      const csvRows = [header, ...rows]
      const csvContent = csvRows.map(row => row.map(escapeCell).join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const safeTitle = round.title
        ? round.title.replace(/[^a-z0-9]+/gi, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '')
        : 'funding_round'
      link.setAttribute('download', `${safeTitle || 'funding_round'}-results.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export funding round results', error)
      const message = error?.message || t('Unable to export results')
      setErrorDialog({
        isOpen: true,
        title: t('Error'),
        message
      })
    } finally {
      setIsExporting(false)
    }
  }, [dispatch, isExporting, round, t])

  return (
    <div className='flex flex-col gap-4 mt-4 pb-4'>
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
                    {phase.isCurrent && phase.key !== 'not-begun' && phase.key !== 'completed' && (
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
                      <span className='px-2 py-0.5 text-xs text-foreground bg-selected rounded-full font-medium'>
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
                <div className='flex flex-wrap gap-2 w-full items-center justify-center mt-4 mb-2'>
                  {showBackButton && (
                    <Button
                      size='sm'
                      className='bg-transparent border-2 border-foreground/20 hover:border-foreground/40 text-foreground'
                      onClick={() => handleGoBackPhase(phase)}
                    >
                      {phase.backButtonText}
                    </Button>
                  )}
                  {phase.key === 'completed' && phase.isCurrent && (
                    <Button
                      size='sm'
                      className='bg-selected text-foreground border-2 border-selected hover:bg-selected/90 '
                      onClick={handleExportResults}
                      disabled={isExporting}
                    >
                      <Download className='w-4 h-4 mr-1' />
                      {isExporting ? t('Exporting...') : t('Export results')}
                    </Button>
                  )}
                  {showForwardButton && (
                    <Button
                      size='sm'
                      className='bg-selected hover:bg-selected/90 text-foreground border-2 border-transparent'
                      onClick={() => handleStartPhase(phase)}
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

      <button
        className='w-full text-destructive border-2 border-destructive/20 hover:border-destructive hover:bg-destructive/10 transition-all px-4 py-2 rounded-md flex flex-row items-center gap-2 justify-center'
        onClick={handleDeleteRound}
      >
        <Trash2 className='w-4 h-4' />
        <span>{t('Delete Round')}</span>
      </button>

      <Dialog open={confirmDialog.isOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>
              {confirmDialog.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='gap-2'>
            <Button
              variant='outline'
              onClick={handleCancelConfirm}
            >
              {t('Cancel')}
            </Button>
            <Button
              className={cn(
                'text-foreground',
                confirmDialog.confirmButtonText === t('Delete')
                  ? 'bg-destructive hover:bg-destructive/90'
                  : 'bg-selected hover:bg-selected/90'
              )}
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
