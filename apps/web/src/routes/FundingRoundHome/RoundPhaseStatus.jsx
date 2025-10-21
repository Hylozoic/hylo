import React from 'react'
import { useTranslation } from 'react-i18next'
import { DateTimeHelpers } from '@hylo/shared'
import { CheckCircle2, FileCheck2, Lock, MessageSquare, Vote } from 'lucide-react'

export default function RoundPhaseStatus ({
  round,
  currentPhase,
  submissionCount = 0,
  currentTokensRemaining = null
}) {
  const { t } = useTranslation()

  if (!round) return null

  const submissionsOpenDate = round.submissionsOpenAt
  const submissionsCloseDate = round.submissionsCloseAt
  const votingOpensDate = round.votingOpensAt
  const votingClosesDate = round.votingClosesAt

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
                {t('Submissions are closed. Discover submissions and join the conversation.')}
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
            {currentTokensRemaining != null && (
              <div className='bg-selected/20 border-2 border-selected rounded-md py-1 px-2 font-bold text-sm'>
                {t('You have {{tokens}} {{tokenType}} remaining', {
                  tokens: currentTokensRemaining,
                  tokenType: round.tokenType || 'votes'
                })}
              </div>
            )}
          </div>
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
          <div className='flex flex-row gap-3 opacity-50'>
            {round.minTokenAllocation && (
              <p className='text-xs text-foreground/80 mb-1 font-normal pt-0 mt-0 border-r-2 border-foreground/20 pr-2'>
                {t('Minimum of {{minTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', {
                  minTokenAllocation: round.minTokenAllocation,
                  tokenType: round.tokenType || t('Votes'),
                  submissionDescriptor: round.submissionDescriptor
                })}
              </p>
            )}
            {round.maxTokenAllocation && (
              <p className='text-xs text-foreground/80 mb-1 font-normal pt-0 mt-0'>
                {t('Maximum of {{maxTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', {
                  maxTokenAllocation: round.maxTokenAllocation,
                  tokenType: round.tokenType || t('Votes'),
                  submissionDescriptor: round.submissionDescriptor
                })}
              </p>
            )}
          </div>
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
