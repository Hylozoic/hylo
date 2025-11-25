import { CheckCircle2, FileCheck2, Lock, MessageSquare, Vote, ShieldAlert } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { DateTimeHelpers } from '@hylo/shared'

export default function RoundPhaseStatus ({
  round,
  currentPhase,
  submissionCount = 0,
  currentTokensRemaining = null,
  canSubmit = true,
  canVote = true
}) {
  const { t } = useTranslation()
  const { submitterRoles, voterRoles } = round || {}

  const submissionsOpenDate = round.submissionsOpenAt
  const submissionsCloseDate = round.submissionsCloseAt
  const votingOpensDate = round.votingOpensAt
  const votingClosesDate = round.votingClosesAt

  // Check if user joined after voting started
  const joinedAfterVotingStarted = round.joinedAt && votingOpensDate &&
    new Date(round.joinedAt) > new Date(votingOpensDate)

  if (!round) return null

  return (
    <div className='mt-4 rounded-md border-dashed border-2 border-foreground/20 p-4 text-sm font-semibold flex flex-col gap-2'>
      {(currentPhase === 'open' || currentPhase === 'draft') && !submissionsOpenDate && (
        <div className='flex items-center flex-col pt-2 justify-center'>
          <Lock className='w-6 h-6 text-foreground flex-shrink-0' />
          <h2 className='text-lg text-foreground mt-0 mb-0'>{t('Submissions are not open yet')}</h2>
          <p className='text-sm font-normal pt-0 mt-0 text-foreground/80'>
            {t('Check back soon to offer your {{submissionDescriptor}}', { submissionDescriptor: round.submissionDescriptor })}
          </p>
        </div>
      )}

      {currentPhase === 'open' && submissionsOpenDate && (
        <span>{t('Submissions open at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: submissionsOpenDate }) })}</span>
      )}

      {currentPhase === 'submissions' && (
        <div className='flex flex-col items-start gap-2'>
          <div className='flex flex-row items-center gap-2 justify-between w-full'>
            <div className='flex flex-row items-center gap-2'>
              <div className='bg-selected/30 rounded-md py-1 px-2 font-bold text-sm h-8 w-8 flex items-center justify-center'>
                <FileCheck2 className='w-6 h-6 text-foreground flex-shrink-0' />
              </div>
              <h2 className='text-xl text-selected mt-0 mb-0 font-bold'>{t('Submissions open!')}</h2>
            </div>
            <div>
              <span className='bg-selected/20 text-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1'>
                <span className='w-2 h-2 bg-selected rounded-full' />
                {t('{{count}} {{submissionDescriptor}}', {
                  count: submissionCount,
                  submissionDescriptor: round.submissionDescriptorPlural
                })}
              </span>
            </div>
          </div>
          {!canSubmit && submitterRoles && submitterRoles.length > 0 && (
            <div className='w-full bg-amber-500/20 border-2 border-amber-500/40 rounded-md p-3 flex items-start gap-2'>
              <ShieldAlert className='w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5' />
              <div className='flex flex-col gap-1'>
                <p className='text-sm font-semibold text-foreground m-0'>
                  {t('You cannot submit to this round')}
                </p>
                <p className='text-xs font-normal text-foreground/70 m-0'>
                  {t('Only participants with one of the following roles can submit: {{roles}}', {
                    roles: submitterRoles.map(r => `${r.emoji} ${r.name}`).join(', ')
                  })}
                </p>
              </div>
            </div>
          )}
          {submissionsCloseDate && (
            <span className='text-sm font-normal pt-0 mt-0 text-foreground/50'>
              {t('Submissions close at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: submissionsCloseDate }) })}
            </span>
          )}
          {votingOpensDate && (
            <span className='text-sm font-normal pt-0 mt-0 text-foreground/50'>
              {t('Voting opens at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: votingOpensDate }) })}
            </span>
          )}
        </div>
      )}

      {currentPhase === 'discussion' && (
        <div className='flex flex-col gap-2'>
          <div className='flex items-start gap-3'>
            <div className='flex-1 flex flex-col gap-2'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='bg-selected/30 rounded-md py-1 px-2 font-bold text-sm h-8 w-8 flex items-center justify-center'>
                    <MessageSquare className='w-4 h-6 text-foreground flex-shrink-0' />
                  </div>
                  <h2 className='text-xl font-bold text-selected mt-0 mb-0'>{t('Discussion in progress')}</h2>
                </div>
                {submissionCount > 0 && (
                  <span className='bg-selected/20 text-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1'>
                    <span className='w-2 h-2 bg-selected rounded-full' />
                    {t('{{count}} {{submissionDescriptor}}', {
                      count: submissionCount,
                      submissionDescriptor: round.submissionDescriptorPlural
                    })}
                  </span>
                )}
              </div>
              <p className='text-sm font-normal text-foreground/80 mt-0 mb-0'>
                {t('Submissions are closed. Discuss the {{submissionDescriptorPlural}} below and in the round Chat room.', { submissionDescriptorPlural: round.submissionDescriptorPlural })}
              </p>
              {votingOpensDate && (
                <p className='text-sm font-semibold -mt-2 mb-0 pt-0'>
                  {t('Voting begins {{date}}', {
                    date: DateTimeHelpers.formatDatePair({ start: votingOpensDate })
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {currentPhase === 'voting' && (
        <div className='flex flex-col gap-2'>
          <div className='flex flex-row gap-2 items-center'>
            <h2 className='text-xl font-bold text-selected flex-1 flex items-center gap-2 my-1'>
              <span className='inline-block w-8 h-8 bg-selected/50 rounded-sm flex items-center justify-center'>
                <Vote className='inline-block w-6 h-6 text-foreground' />
              </span>
              {t('Voting in progress')}
            </h2>
            {canVote && !joinedAfterVotingStarted && currentTokensRemaining != null && (
              <div className='bg-selected/20 border-2 border-selected rounded-md py-1 px-2 font-bold text-sm'>
                {t('You have {{tokens}} {{tokenType}} remaining', {
                  tokens: currentTokensRemaining,
                  tokenType: round.tokenType || 'votes'
                })}
              </div>
            )}
          </div>
          {!canVote && voterRoles && voterRoles.length > 0 && !joinedAfterVotingStarted && (
            <div className='w-full bg-amber-500/20 border-2 border-amber-500/40 rounded-md p-3 flex items-start gap-2'>
              <ShieldAlert className='w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5' />
              <div className='flex flex-col gap-1'>
                <p className='text-sm font-semibold text-foreground m-0'>
                  {t('You cannot vote in this round')}
                </p>
                <p className='text-xs font-normal text-foreground/70 m-0'>
                  {t('Only participants with one of the following roles can vote: {{roles}}', {
                    roles: voterRoles.map(r => `${r.emoji} ${r.name}`).join(', ')
                  })}
                </p>
              </div>
            </div>
          )}
          {joinedAfterVotingStarted && (
            <div className='w-full bg-amber-500/20 border-2 border-amber-500/40 rounded-md p-3 flex items-start gap-2'>
              <ShieldAlert className='w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5' />
              <div className='flex flex-col gap-1'>
                <p className='text-sm font-semibold text-foreground m-0'>
                  {t('You cannot vote in this round')}
                </p>
                <p className='text-xs font-normal text-foreground/70 m-0'>
                  {t('You joined after voting started. {{tokenType}} have already been allocated to participants who joined before voting began.', {
                    tokenType: round.tokenType || t('Votes')
                  })}
                </p>
              </div>
            </div>
          )}
          {canVote && !joinedAfterVotingStarted && (
            <div>
              <p className='text-sm text-foreground/80 mt-0 mb-0 pt-0 font-normal'>
                {t('Allocate your {{tokenType}} to the {{submissionDescriptor}} you think deserve support', {
                  tokenType: round.tokenType || t('Votes'),
                  submissionDescriptor: round.submissionDescriptor
                })}
              </p>
              {votingClosesDate && (
                <span className='text-sm font-normal pt-0 mt-0 text-foreground/50'>
                  {t('Voting closes at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: votingClosesDate }) })}
                </span>
              )}
            </div>
          )}
          {canVote && !joinedAfterVotingStarted && (
            <div className='flex flex-row gap-3 opacity-50'>
              {typeof round.minTokenAllocation === 'number' && round.minTokenAllocation > 0 && (
                <p className='text-xs text-foreground/80 mb-1 font-normal pt-0 mt-0 border-r-2 border-foreground/20 pr-2'>
                  {t('Minimum of {{minTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', {
                    minTokenAllocation: round.minTokenAllocation,
                    tokenType: round.tokenType || t('Votes'),
                    submissionDescriptor: round.submissionDescriptor
                  })}
                </p>
              )}
              {typeof round.maxTokenAllocation === 'number' && round.maxTokenAllocation > 0 && (
                <p className='text-xs text-foreground/80 mb-1 font-normal pt-0 mt-0'>
                  {t('Maximum of {{maxTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', {
                    maxTokenAllocation: round.maxTokenAllocation,
                    tokenType: round.tokenType || t('Votes'),
                    submissionDescriptor: round.submissionDescriptor
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {currentPhase === 'completed' && (
        <div className='flex flex-col gap-2'>
          <div className='flex items-center gap-3'>
            <div className='bg-selected/30 rounded-md py-1 px-2 font-bold text-sm h-8 w-8 flex items-center justify-center'>
              <CheckCircle2 className='w-6 h-6 text-foreground flex-shrink-0' />
            </div>
            <h2 className='text-xl font-bold text-selected mt-0 mb-0'>{t('Round Complete!')}</h2>
          </div>
          <div className='text-base font-semibold text-foreground/80'>
            {t('{{numParticipants}} Participants allocated {{totalTokens}} {{tokenType}}!', {
              numParticipants: round.numParticipants || 0,
              totalTokens: round.totalTokensAllocated || 0,
              tokenType: round.tokenType || t('votes')
            })}
          </div>
        </div>
      )}
    </div>
  )
}
