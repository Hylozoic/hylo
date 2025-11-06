import React from 'react'
import { View, Text } from 'react-native'
import { CheckCircle2, FileCheck2, Lock, MessageSquare, Vote, ShieldAlert } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { DateTimeHelpers } from '@hylo/shared'

// Component to display the current phase status of a funding round
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

  const submissionsOpenDate = round?.submissionsOpenAt
  const submissionsCloseDate = round?.submissionsCloseAt
  const votingOpensDate = round?.votingOpensAt
  const votingClosesDate = round?.votingClosesAt

  // Check if user joined after voting started
  const joinedAfterVotingStarted = round?.joinedAt && votingOpensDate &&
    new Date(round.joinedAt) > new Date(votingOpensDate)

  if (!round) return null

  return (
    <View className='mt-4 rounded-md border-dashed border-2 border-foreground/20 p-4'>
      {(currentPhase === 'open' || currentPhase === 'draft') && !submissionsOpenDate && (
        <View className='flex items-center pt-2'>
          <Lock className='w-6 h-6 text-foreground' />
          <Text className='text-lg text-foreground font-semibold mt-2'>{t('Submissions are not open yet')}</Text>
          <Text className='text-sm text-foreground/80 text-center mt-1'>
            {t('Check back soon to offer your {{submissionDescriptor}}', { submissionDescriptor: round.submissionDescriptor })}
          </Text>
        </View>
      )}

      {currentPhase === 'open' && submissionsOpenDate && (
        <Text className='text-sm font-semibold text-foreground'>
          {t('Submissions open at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: submissionsOpenDate }) })}
        </Text>
      )}

      {currentPhase === 'submissions' && (
        <View className='gap-2'>
          <View className='flex-row items-center justify-between w-full'>
            <View className='flex-row items-center gap-2'>
              <View className='bg-selected/30 rounded-md py-1 px-2 h-8 w-8 items-center justify-center'>
                <FileCheck2 className='w-6 h-6 text-foreground' />
              </View>
              <Text className='text-xl text-selected font-bold'>{t('Submissions open!')}</Text>
            </View>
            <View>
              <View className='bg-selected/20 px-2 py-1 rounded-full flex-row items-center gap-1'>
                <View className='w-2 h-2 bg-selected rounded-full' />
                <Text className='text-xs font-bold text-foreground'>
                  {t('{{count}} {{submissionDescriptor}}', {
                    count: submissionCount,
                    submissionDescriptor: round.submissionDescriptorPlural
                  })}
                </Text>
              </View>
            </View>
          </View>
          {!canSubmit && submitterRoles && submitterRoles.length > 0 && (
            <View className='w-full bg-amber-500/20 border-2 border-amber-500/40 rounded-md p-3 flex-row gap-2'>
              <ShieldAlert className='w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5' />
              <View className='flex-1 gap-1'>
                <Text className='text-sm font-semibold text-foreground'>
                  {t('You cannot submit to this round')}
                </Text>
                <Text className='text-xs text-foreground/70'>
                  {t('Only participants with one of the following roles can submit: {{roles}}', {
                    roles: submitterRoles.map(r => `${r.emoji} ${r.name}`).join(', ')
                  })}
                </Text>
              </View>
            </View>
          )}
          {submissionsCloseDate && (
            <Text className='text-sm text-foreground/50'>
              {t('Submissions close at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: submissionsCloseDate }) })}
            </Text>
          )}
          {votingOpensDate && (
            <Text className='text-sm text-foreground/50'>
              {t('Voting opens at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: votingOpensDate }) })}
            </Text>
          )}
        </View>
      )}

      {currentPhase === 'discussion' && (
        <View className='gap-2'>
          <View className='flex-1 gap-2'>
            <View className='flex-row items-center justify-between'>
              <View className='flex-row items-center gap-2'>
                <View className='bg-selected/30 rounded-md py-1 px-2 h-8 w-8 items-center justify-center'>
                  <MessageSquare className='w-6 h-6 text-foreground' />
                </View>
                <Text className='text-xl font-bold text-selected'>{t('Discussion in progress')}</Text>
              </View>
              {submissionCount > 0 && (
                <View className='bg-selected/20 px-2 py-1 rounded-full flex-row items-center gap-1'>
                  <View className='w-2 h-2 bg-selected rounded-full' />
                  <Text className='text-xs font-bold text-foreground'>
                    {t('{{count}} {{submissionDescriptor}}', {
                      count: submissionCount,
                      submissionDescriptor: round.submissionDescriptorPlural
                    })}
                  </Text>
                </View>
              )}
            </View>
            <Text className='text-sm text-foreground/80'>
              {t('Submissions are closed. Discuss the {{submissionDescriptorPlural}} below and in the round Chat room.', { submissionDescriptorPlural: round.submissionDescriptorPlural })}
            </Text>
            {votingOpensDate && (
              <Text className='text-sm font-semibold text-foreground'>
                {t('Voting begins {{date}}', {
                  date: DateTimeHelpers.formatDatePair({ start: votingOpensDate })
                })}
              </Text>
            )}
          </View>
        </View>
      )}

      {currentPhase === 'voting' && (
        <View className='gap-2'>
          <View className='flex-row gap-2 items-center'>
            <View className='flex-1 flex-row items-center gap-2'>
              <View className='w-8 h-8 bg-selected/50 rounded-sm items-center justify-center'>
                <Vote className='w-6 h-6 text-foreground' />
              </View>
              <Text className='text-xl font-bold text-selected'>{t('Voting in progress')}</Text>
            </View>
            {canVote && !joinedAfterVotingStarted && currentTokensRemaining != null && (
              <View className='bg-selected/20 border-2 border-selected rounded-md py-1 px-2'>
                <Text className='text-sm font-bold text-foreground'>
                  {t('{{tokens}} {{tokenType}}', {
                    tokens: currentTokensRemaining,
                    tokenType: round.tokenType || 'votes'
                  })}
                </Text>
              </View>
            )}
          </View>
          {!canVote && voterRoles && voterRoles.length > 0 && !joinedAfterVotingStarted && (
            <View className='w-full bg-amber-500/20 border-2 border-amber-500/40 rounded-md p-3 flex-row gap-2'>
              <ShieldAlert className='w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5' />
              <View className='flex-1 gap-1'>
                <Text className='text-sm font-semibold text-foreground'>
                  {t('You cannot vote in this round')}
                </Text>
                <Text className='text-xs text-foreground/70'>
                  {t('Only participants with one of the following roles can vote: {{roles}}', {
                    roles: voterRoles.map(r => `${r.emoji} ${r.name}`).join(', ')
                  })}
                </Text>
              </View>
            </View>
          )}
          {joinedAfterVotingStarted && (
            <View className='w-full bg-amber-500/20 border-2 border-amber-500/40 rounded-md p-3 flex-row gap-2'>
              <ShieldAlert className='w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5' />
              <View className='flex-1 gap-1'>
                <Text className='text-sm font-semibold text-foreground'>
                  {t('You cannot vote in this round')}
                </Text>
                <Text className='text-xs text-foreground/70'>
                  {t('You joined after voting started. {{tokenType}} have already been allocated to participants who joined before voting began.', {
                    tokenType: round.tokenType || t('Votes')
                  })}
                </Text>
              </View>
            </View>
          )}
          {canVote && !joinedAfterVotingStarted && (
            <View>
              <Text className='text-sm text-foreground/80'>
                {t('Allocate your {{tokenType}} to the {{submissionDescriptor}} you think deserve support', {
                  tokenType: round.tokenType || t('Votes'),
                  submissionDescriptor: round.submissionDescriptor
                })}
              </Text>
              {votingClosesDate && (
                <Text className='text-sm text-foreground/50'>
                  {t('Voting closes at {{date}}', { date: DateTimeHelpers.formatDatePair({ start: votingClosesDate }) })}
                </Text>
              )}
            </View>
          )}
          {canVote && !joinedAfterVotingStarted && (round.minTokenAllocation || round.maxTokenAllocation) && (
            <View className='flex-row gap-3 opacity-50'>
              {round.minTokenAllocation && (
                <Text className='text-xs text-foreground/80 border-r-2 border-foreground/20 pr-2'>
                  {t('Minimum of {{minTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', {
                    minTokenAllocation: round.minTokenAllocation,
                    tokenType: round.tokenType || t('Votes'),
                    submissionDescriptor: round.submissionDescriptor
                  })}
                </Text>
              )}
              {round.maxTokenAllocation && (
                <Text className='text-xs text-foreground/80'>
                  {t('Maximum of {{maxTokenAllocation}} {{tokenType}} / {{submissionDescriptor}}', {
                    maxTokenAllocation: round.maxTokenAllocation,
                    tokenType: round.tokenType || t('Votes'),
                    submissionDescriptor: round.submissionDescriptor
                  })}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {currentPhase === 'completed' && (
        <View className='gap-2'>
          <View className='flex-row items-center gap-3'>
            <View className='bg-selected/30 rounded-md py-1 px-2 h-8 w-8 items-center justify-center'>
              <CheckCircle2 className='w-6 h-6 text-foreground' />
            </View>
            <Text className='text-xl font-bold text-selected'>{t('Round Complete!')}</Text>
          </View>
          <Text className='text-base font-semibold text-foreground/80'>
            {t('{{numParticipants}} Participants allocated {{totalTokens}} {{tokenType}}!', {
              numParticipants: round.numParticipants || 0,
              totalTokens: round.totalTokensAllocated || 0,
              tokenType: round.tokenType || t('votes')
            })}
          </Text>
        </View>
      )}
    </View>
  )
}
