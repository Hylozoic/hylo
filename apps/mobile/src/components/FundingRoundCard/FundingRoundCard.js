// DEPRECATED: This component is only used by deprecated screens (FundingRounds).
// Kept for reference only.

import React from 'react'
import { View, Text, Pressable, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
// DEPRECATED: lucide-react-native removed
// import { UserPlus } from 'lucide-react-native'
import { DateTimeHelpers } from '@hylo/shared'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useOpenURL from 'hooks/useOpenURL'
import { groupUrl } from '@hylo/navigation'

// Get phase information for a funding round
function getRoundPhase (round, t) {
  if (!round?.publishedAt) {
    return {
      key: 'draft',
      label: t('Draft'),
      badgeClass: 'bg-foreground/20'
    }
  }

  const toDate = (value) => (value ? new Date(value) : null)
  const formatDate = (value) => (value ? DateTimeHelpers.formatDatePair({ start: value }) : null)
  const formatCompletedDate = (value) => {
    if (!value) return null
    const date = new Date(value)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const now = new Date()
  const submissionsOpenAt = toDate(round.submissionsOpenAt)
  const submissionsCloseAt = toDate(round.submissionsCloseAt)
  const votingOpensAt = toDate(round.votingOpensAt)
  const votingClosesAt = toDate(round.votingClosesAt)

  if (votingClosesAt && votingClosesAt <= now) {
    const completedDate = formatCompletedDate(round.votingClosesAt)
    return {
      key: 'completed',
      label: completedDate ? t('Completed {{date}}', { date: completedDate }) : t('Completed'),
      badgeClass: 'bg-focus/50'
    }
  }

  if (votingOpensAt && votingOpensAt <= now) {
    return {
      key: 'voting',
      label: t('Voting open'),
      badgeClass: 'bg-accent/50'
    }
  }

  if (submissionsCloseAt && submissionsCloseAt <= now) {
    return {
      key: 'discussion',
      label: t('Discussion phase'),
      badgeClass: 'bg-purple-500/50'
    }
  }

  if (submissionsOpenAt && submissionsOpenAt <= now) {
    return {
      key: 'submissions',
      label: t('Submissions open'),
      badgeClass: 'bg-selected/50'
    }
  }

  const scheduledDate = formatDate(round.submissionsOpenAt)
  return {
    key: 'not-begun',
    label: scheduledDate ? t('Starts {{date}}', { date: scheduledDate }) : t('Not yet started'),
    badgeClass: 'bg-foreground/20'
  }
}

function FundingRoundCard ({ fundingRound, groupSlug }) {
  const { t } = useTranslation()
  const [{ currentGroup }] = useCurrentGroup()
  const openURL = useOpenURL()

  const phase = getRoundPhase(fundingRound, t)
  const participants = fundingRound.users || []
  const participantPreview = participants.slice(0, 3)
  const participantCount = fundingRound.numParticipants || participants.length

  const navigateToFundingRound = () => {
    const fundingRoundUrl = `${groupUrl(groupSlug || currentGroup?.slug, 'funding-rounds')}/${fundingRound.id}`
    openURL(fundingRoundUrl)
  }

  return (
    <Pressable
      onPress={navigateToFundingRound}
      className='mb-2'
    >
      <View className='rounded-xl p-4 flex flex-col bg-card/50 border-2 border-card/30'>
        <View className='flex flex-col space-y-2 pb-2'>
          <View className='flex flex-row items-center gap-3'>
            <Text className='text-lg text-foreground font-semibold flex-1' numberOfLines={2}>
              {fundingRound.title}
            </Text>
            <View className={`px-2 py-0.5 rounded-full ${phase.badgeClass}`}>
              <Text className='text-xs text-foreground font-medium'>
                {phase.label}
              </Text>
            </View>
          </View>
          {fundingRound.description && (
            <Text className='text-sm text-foreground/80' numberOfLines={2}>
              {fundingRound.description.replace(/<[^>]*>/g, '')}
            </Text>
          )}
        </View>

        <View className='flex flex-row items-center justify-between pt-2'>
          <View className='flex flex-row items-center gap-3 px-3 py-1 rounded-full bg-foreground/5'>
            {participantPreview.length > 0 && (
              <View className='flex flex-row -space-x-2 items-center'>
                {participantPreview.map(user => (
                  user.avatarUrl
                    ? (
                      <Image
                        key={user.id}
                        source={{ uri: user.avatarUrl }}
                        className='w-5 h-5 rounded-full border border-background'
                      />
                      )
                    : (
                      <View key={user.id} className='flex items-center justify-center w-5 h-5 rounded-full bg-muted border border-background'>
                        <Text className='text-[0.65rem] font-semibold text-muted-foreground uppercase'>
                          {(user.name || '?').slice(0, 1)}
                        </Text>
                      </View>
                      )
                ))}
              </View>
            )}
            <Text className='text-xs text-foreground font-medium'>
              {t('{{count}} participants', { count: participantCount })}
            </Text>
          </View>

          {fundingRound.isParticipating && (
            <View className='flex flex-row items-center gap-1 px-2 py-1 rounded-md bg-selected/20'>
              <UserPlus className='w-3 h-3 text-foreground' />
              <Text className='text-xs text-foreground'>{t('Joined')}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  )
}

export default FundingRoundCard
