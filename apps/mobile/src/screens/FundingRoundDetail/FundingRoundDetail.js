// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Animated, Platform, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, DoorOpen } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { TextHelpers } from '@hylo/shared'
import useOpenURL from 'hooks/useOpenURL'
import { personUrl } from '@hylo/navigation'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useFundingRound from '@hylo/hooks/useFundingRound'
import useFundingRoundParticipation from '@hylo/hooks/useFundingRoundParticipation'
import HyloHTML from 'components/HyloHTML'
import HyloWebView from 'components/HyloWebView'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Loading from 'components/Loading'
import RoundPhaseStatus from 'components/RoundPhaseStatus'
import SubmissionCard from 'components/SubmissionCard'
import useRouteParams from 'hooks/useRouteParams'

const TabButton = ({ isSelected, onPress, children }) => {
  const windowWidth = Dimensions.get('window').width
  // Use smaller padding on smaller devices (e.g., phones < 400px width)
  const paddingX = windowWidth < 375 ? 'px-2' : windowWidth < 400 ? 'px-3' : 'px-4'

  return (
    <TouchableOpacity
      className={`py-1 ${paddingX} rounded-md border-2 ${
        isSelected
          ? 'bg-selected border-selected'
          : 'bg-transparent border-foreground/20'
      }`}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}
    >
      <Text className='text-foreground'>{children}</Text>
    </TouchableOpacity>
  )
}

// Get current phase of funding round
function getRoundPhase (round) {
  if (!round) return 'draft'

  const now = new Date()
  const toDate = (value) => value ? new Date(value) : null

  const submissionsOpenAt = toDate(round.submissionsOpenAt)
  const submissionsCloseAt = toDate(round.submissionsCloseAt)
  const votingOpensAt = toDate(round.votingOpensAt)
  const votingClosesAt = toDate(round.votingClosesAt)

  if (votingClosesAt && votingClosesAt <= now) return 'completed'
  if (votingOpensAt && votingOpensAt <= now) return 'voting'
  if (submissionsCloseAt && submissionsCloseAt <= now) return 'discussion'
  if (submissionsOpenAt && submissionsOpenAt <= now) return 'submissions'
  if (round.publishedAt && new Date(round.publishedAt) <= now) return 'open'

  return 'draft'
}

const AboutTab = ({ fundingRound, currentPhase, canSubmit, canVote }) => {
  const { t } = useTranslation()
  const { bannerUrl, title, description, criteria, requireBudget, tokenType, totalTokens, minTokenAllocation, maxTokenAllocation, submitterRoles, voterRoles } = fundingRound

  const submissionCount = fundingRound.submissions?.length || 0

  const renderRoles = (roles) => {
    if (!roles || roles.length === 0) {
      return (
        <Text className='text-sm'>{t('Any member')}</Text>
      )
    }
    return roles.map((role, index) => (
      <View key={role.id} className='flex-row items-center gap-1 px-2 py-1 bg-accent/20 rounded-md mr-2 mb-2'>
        <Text className='text-base'>{role.emoji}</Text>
        <Text className='text-sm'>{role.name}</Text>
      </View>
    ))
  }

  return (
    <ScrollView
      className='flex-1 pb-4'
      showsVerticalScrollIndicator
    >
      <RoundPhaseStatus
        round={fundingRound}
        currentPhase={currentPhase}
        submissionCount={submissionCount}
        canSubmit={canSubmit}
        canVote={canVote}
      />

      <View className={`mt-4 w-full rounded-xl h-[40vh] items-center justify-center bg-foreground/20 ${Platform.OS === 'ios' ? 'shadow-2xl' : ''}`}>
        {bannerUrl && (
          <Image
            source={{ uri: bannerUrl }}
            className='absolute w-full h-full rounded-xl'
            resizeMode='cover'
          />
        )}
        <Text className='text-white text-4xl font-bold px-4 text-center'>{title}</Text>
      </View>

      <View className='flex-1 mt-4'>
        {description && <HyloHTML html={TextHelpers.markdown(description)} />}

        {criteria && (
          <View className='mt-4'>
            <Text className='text-lg font-semibold mb-2'>{t('Submission Criteria')}</Text>
            <HyloHTML html={TextHelpers.markdown(criteria)} />
          </View>
        )}

        <View className='flex-row flex-wrap gap-3 mt-4'>
          <View className='border border-foreground/20 rounded-lg p-3 flex-1 min-w-[150px]'>
            <Text className='text-xs text-foreground/60 uppercase'>{t('Budget Required')}</Text>
            <Text className='text-base'>{requireBudget ? t('Yes') : t('No')}</Text>
          </View>
          <View className='border border-foreground/20 rounded-lg p-3 flex-1 min-w-[150px]'>
            <Text className='text-xs text-foreground/60 uppercase'>{t('Token Type')}</Text>
            <Text className='text-base'>{tokenType}</Text>
          </View>
          <View className='border border-foreground/20 rounded-lg p-3 flex-1 min-w-[150px]'>
            <Text className='text-xs text-foreground/60 uppercase'>{t('Total Tokens')}</Text>
            <Text className='text-base'>{totalTokens}</Text>
          </View>
          {minTokenAllocation != null && (
            <View className='border border-foreground/20 rounded-lg p-3 flex-1 min-w-[150px]'>
              <Text className='text-xs text-foreground/60 uppercase'>{t('Min per Submission')}</Text>
              <Text className='text-base'>{minTokenAllocation}</Text>
            </View>
          )}
          {maxTokenAllocation != null && (
            <View className='border border-foreground/20 rounded-lg p-3 flex-1 min-w-[150px]'>
              <Text className='text-xs text-foreground/60 uppercase'>{t('Max per Submission')}</Text>
              <Text className='text-base'>{maxTokenAllocation}</Text>
            </View>
          )}
        </View>

        <View className='flex-row flex-wrap gap-3 mt-4'>
          <View className='border border-foreground/20 rounded-lg p-3 flex-1 min-w-[200px]'>
            <Text className='text-xs text-foreground/60 uppercase mb-2'>{t('Who Can Submit')}</Text>
            <View className='flex-row flex-wrap'>{renderRoles(submitterRoles)}</View>
          </View>
          <View className='border border-foreground/20 rounded-lg p-3 flex-1 min-w-[200px]'>
            <Text className='text-xs text-foreground/60 uppercase mb-2'>{t('Who Can Vote')}</Text>
            <View className='flex-row flex-wrap'>{renderRoles(voterRoles)}</View>
          </View>
        </View>

        <View className='h-32' />
      </View>
    </ScrollView>
  )
}

const SubmissionsTab = ({ fundingRound, currentPhase, groupSlug, canVote, canSubmit, groupId }) => {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const submissions = fundingRound.submissions || []
  const [localVoteAmounts, setLocalVoteAmounts] = React.useState({})

  // Sort submissions by votes (when complete) or ID descending (most recent first)
  const sortedSubmissions = React.useMemo(() => {
    return [...submissions].sort((a, b) => {
      if (currentPhase === 'completed') {
        // Sort by tokens allocated descending (most votes first)
        const aTokens = a.tokensAllocated || 0
        const bTokens = b.tokensAllocated || 0
        return bTokens - aTokens
      }
      // Default: sort by ID descending (most recent first)
      return b.id - a.id
    })
  }, [submissions, currentPhase])

  // Initialize local vote amounts for new submissions only
  React.useEffect(() => {
    setLocalVoteAmounts(prev => {
      const newAmounts = { ...prev }
      submissions.forEach(submission => {
        if (!(submission.id in newAmounts)) {
          newAmounts[submission.id] = submission.tokensAllocated || 0
        }
      })
      return newAmounts
    })
  }, [submissions])

  // Calculate instant remaining tokens based on difference between server and local state
  const currentTokensRemaining = React.useMemo(() => {
    if (fundingRound.tokensRemaining == null) return null

    // Start with the round's remaining tokens (reflects server state)
    let remaining = fundingRound.tokensRemaining

    // For each submission, add back server amount and subtract local amount
    // This accounts for the delta between what's saved and what the user is changing
    submissions.forEach(submission => {
      const serverAmount = submission.tokensAllocated || 0
      const localAmount = localVoteAmounts[submission.id] || 0
      remaining += serverAmount - localAmount
    })

    return remaining
  }, [fundingRound.tokensRemaining, submissions, localVoteAmounts])

  const handleSubmissionPress = (submission) => {
    navigation.navigate('Post Details', { id: submission.id })
  }

  const handleCreateSubmission = () => {
    navigation.navigate('Edit Post', {
      type: 'submission',
      fundingRoundId: fundingRound.id,
      submissionDescriptor: fundingRound.submissionDescriptor,
      groupId
    })
  }

  return (
    <ScrollView
      className='flex-1'
      contentContainerClassName='py-4 gap-y-2'
      showsVerticalScrollIndicator={false}
    >
      <RoundPhaseStatus
        round={fundingRound}
        currentPhase={currentPhase}
        submissionCount={sortedSubmissions.length}
        currentTokensRemaining={currentTokensRemaining}
        canSubmit={canSubmit}
        canVote={canVote}
      />

      {currentPhase === 'submissions' && fundingRound.canSubmit && (
        <TouchableOpacity
          className='w-full border-2 border-foreground/20 px-4 py-2 rounded-md items-center'
          onPress={handleCreateSubmission}
        >
          <Text className='text-foreground'>+ {t('Add {{submissionDescriptor}}', { submissionDescriptor: fundingRound.submissionDescriptor })}</Text>
        </TouchableOpacity>
      )}

      {sortedSubmissions.length === 0 && (
        <Text className='text-foreground/60 text-center py-8'>
          {t('No {{submissionDescriptor}} yet', { submissionDescriptor: fundingRound.submissionDescriptorPlural })}
        </Text>
      )}

      {sortedSubmissions.map(submission => (
        <SubmissionCard
          key={submission.id}
          submission={submission}
          currentPhase={currentPhase}
          canVote={canVote}
          fundingRound={fundingRound}
          onPress={() => handleSubmissionPress(submission)}
          localVoteAmount={localVoteAmounts[submission.id] || 0}
          setLocalVoteAmount={(amount) => setLocalVoteAmounts(prev => ({ ...prev, [submission.id]: amount }))}
          currentTokensRemaining={currentTokensRemaining}
        />
      ))}
      <View className='h-20' />
    </ScrollView>
  )
}

const PeopleTab = ({ fundingRound, group, currentPhase, canSubmit, canVote }) => {
  const { t } = useTranslation()
  const openURL = useOpenURL()
  const users = fundingRound.users || []

  const submissionCount = fundingRound.submissions?.length || 0

  // Check if a user has any of the required roles
  const userHasRole = (user, requiredRoles, groupId) => {
    if (!requiredRoles || requiredRoles.length === 0) return true

    for (const requiredRole of requiredRoles) {
      if (requiredRole.type === 'common') {
        const hasCommonRole = user.membershipCommonRoles?.items?.some(
          mcr => mcr.commonRoleId === requiredRole.id && mcr.groupId === groupId
        )
        if (hasCommonRole) return true
      } else {
        const hasGroupRole = user.groupRoles?.items?.some(
          gr => gr.id === requiredRole.id && gr.groupId === groupId && gr.active
        )
        if (hasGroupRole) return true
      }
    }
    return false
  }

  return (
    <ScrollView
      className='flex-1'
      contentContainerClassName='py-4'
      showsVerticalScrollIndicator={false}
    >
      <RoundPhaseStatus
        round={fundingRound}
        currentPhase={currentPhase}
        submissionCount={submissionCount}
        canSubmit={canSubmit}
        canVote={canVote}
      />

      <Text className='text-xl mb-4 mt-4'>
        {users.length > 0
          ? t('{{count}} participants', { count: users.length })
          : t('No one has joined this round')}
      </Text>

      {users.length > 0 && (
        <View className='gap-y-4'>
          {users.map(user => {
            const canSubmit = userHasRole(user, fundingRound.submitterRoles, group.id)
            const canVote = userHasRole(user, fundingRound.voterRoles, group.id)
            const isViewer = !canSubmit && !canVote

            return (
              <View key={user.id} className='flex-row items-center justify-between p-2 bg-foreground/10 rounded-md'>
                <TouchableOpacity onPress={() => openURL(personUrl(user.id, group.slug))}>
                  <View className='flex-row items-center gap-x-2'>
                    <Image
                      source={{ uri: user.avatarUrl }}
                      className='w-10 h-10 rounded-full'
                    />
                    <Text>{user.name}</Text>
                  </View>
                </TouchableOpacity>
                <View className='flex-row gap-x-2'>
                  {canSubmit && (
                    <View className='px-2 py-1 bg-selected/20 rounded-md'>
                      <Text className='text-xs'>{t('Can Submit')}</Text>
                    </View>
                  )}
                  {canVote && (
                    <View className='px-2 py-1 bg-selected/20 rounded-md'>
                      <Text className='text-xs'>{t('Can Vote')}</Text>
                    </View>
                  )}
                  {isViewer && (
                    <View className='px-2 py-1 bg-foreground/10 rounded-md'>
                      <Text className='text-xs'>{t('Viewer')}</Text>
                    </View>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      )}
      <View className='h-20' />
    </ScrollView>
  )
}

const ChatTab = ({ fundingRound, groupSlug }) => {
  const insets = useSafeAreaInsets()

  if (!fundingRound?.id || !groupSlug) return null

  const path = `/groups/${groupSlug}/chat/‡funding_round_${fundingRound.id}`

  return (
    <KeyboardFriendlyView
      style={{ flex: 1 }}
      keyboardVerticalOffset={insets.bottom}
    >
      <HyloWebView path={path} />
    </KeyboardFriendlyView>
  )
}

function FundingRoundDetail () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const routeParams = useRouteParams()
  const [{ currentGroup }] = useCurrentGroup()
  const [fundingRound, { fetching, error }, requeryFundingRound] = useFundingRound({
    fundingRoundId: routeParams.fundingRoundId
  })

  const currentPhase = useMemo(() => getRoundPhase(fundingRound), [fundingRound])

  // Initialize tab from route params if provided, otherwise default to 'about'
  const validTabs = ['about', 'submissions', 'people', 'chat']
  const initialTab = validTabs.includes(routeParams.tab) ? routeParams.tab : 'about'
  const [currentTab, setCurrentTab] = useState(initialTab)

  const {
    joinFundingRound,
    leaveFundingRound,
    joining,
    leaving,
    error: participationError
  } = useFundingRoundParticipation()

  // Animation values
  const [tabAnimation] = useState(new Animated.Value(0))

  useEffect(() => {
    if (fundingRound?.isParticipating) {
      // Animate in
      Animated.spring(tabAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 30,
        friction: 10
      }).start()
    } else {
      // Animate out
      Animated.spring(tabAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 30,
        friction: 10
      }).start()
    }
  }, [fundingRound?.isParticipating])

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (currentTab === 'submissions') {
        requeryFundingRound({ requestPolicy: 'network-only' })
      }
    })

    return unsubscribe
  }, [navigation, currentTab, requeryFundingRound])

  if (fetching && !fundingRound) return <Loading />
  if (error || participationError) {
    return (
      <Text className='text-error text-center py-4'>
        {t('Error loading funding round')}
      </Text>
    )
  }

  if (!fundingRound && !fetching) {
    return (
      <Text className='text-error text-center py-4'>
        {t('Funding round not found')}
      </Text>
    )
  }

  const handleJoin = async () => {
    const success = await joinFundingRound(fundingRound.id)
    if (!success) {
      Alert.alert(
        t('Error'),
        t('Failed to join funding round'),
        [{ text: t('Ok') }]
      )
    }
  }

  const handleLeave = async () => {
    const success = await leaveFundingRound(fundingRound.id)
    if (!success) {
      Alert.alert(
        t('Error'),
        t('Failed to leave funding round'),
        [{ text: t('Ok') }]
      )
    }
  }

  const tabAnimatedStyle = {
    opacity: tabAnimation,
    transform: [{
      translateY: tabAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-20, 0]
      })
    }]
  }

  return (
    <View className='flex-1 bg-background'>
      <View className='flex-1 px-4 mt-2'>
        <View className='max-w-[750px] mx-auto flex-1 w-full'>
          {fundingRound?.isParticipating && (
            <Animated.View
              style={tabAnimatedStyle}
              className='w-full bg-foreground/20 rounded-md p-2'
            >
              <View className='flex-row gap-2 justify-center'>
                <TabButton
                  isSelected={currentTab === 'about'}
                  onPress={() => setCurrentTab('about')}
                >
                  {t('About')}
                </TabButton>

                <TabButton
                  isSelected={currentTab === 'submissions'}
                  onPress={() => {
                    setCurrentTab('submissions')
                    requeryFundingRound({ requestPolicy: 'network-only' })
                  }}
                >
                  {currentPhase === 'voting' ? t('Vote') : fundingRound.submissionDescriptorPlural}
                </TabButton>

                <TabButton
                  isSelected={currentTab === 'people'}
                  onPress={() => setCurrentTab('people')}
                >
                  {t('People')}
                </TabButton>

                <TabButton
                  isSelected={currentTab === 'chat'}
                  onPress={() => setCurrentTab('chat')}
                >
                  {t('Chat')}
                </TabButton>
              </View>
            </Animated.View>
          )}

          {currentTab === 'about' && (
            <AboutTab
              fundingRound={fundingRound}
              currentPhase={currentPhase}
              canSubmit={fundingRound.canSubmit}
              canVote={fundingRound.canVote}
            />
          )}

          {currentTab === 'submissions' && (
            <SubmissionsTab
              fundingRound={fundingRound}
              currentPhase={currentPhase}
              groupSlug={currentGroup?.slug}
              groupId={currentGroup?.id}
              canVote={fundingRound.canVote}
              canSubmit={fundingRound.canSubmit}
            />
          )}

          {currentTab === 'people' && (
            <PeopleTab
              fundingRound={fundingRound}
              group={currentGroup}
              currentPhase={currentPhase}
              canSubmit={fundingRound.canSubmit}
              canVote={fundingRound.canVote}
            />
          )}

          {currentTab === 'chat' && (
            <ChatTab
              fundingRound={fundingRound}
              groupSlug={currentGroup?.slug}
            />
          )}
        </View>
      </View>

      {currentTab === 'about' && (
        <View className='absolute bottom-0 left-0 right-0 bg-background shadow-lg'>
          {!fundingRound.isParticipating
            ? (
              <View className='flex-row gap-2 w-full px-2 py-1 justify-between items-center bg-input'>
                <Text>{t('Ready to jump in?')}</Text>
                <TouchableOpacity
                  className='bg-selected rounded-md p-2 px-4'
                  onPress={handleJoin}
                  disabled={joining}
                >
                  <Text className='text-foreground'>
                    {joining ? t('Joining...') : t('Join')}
                  </Text>
                </TouchableOpacity>
              </View>
              )
            : (
              <View className='flex-row gap-2 m-2 border-2 border-foreground/20 rounded-md px-2 py-2 justify-between items-center'>
                <View className='flex-row gap-2 items-center'>
                  <Check />
                  <Text>{t('You joined this round')}</Text>
                </View>
                <TouchableOpacity
                  className='border-2 border-foreground/20 flex-row gap-2 items-center rounded-md p-2 px-4'
                  onPress={handleLeave}
                  disabled={leaving}
                >
                  <DoorOpen className='w-4 h-4' />
                  <Text>
                    {leaving ? t('Leaving...') : t('Leave Round')}
                  </Text>
                </TouchableOpacity>
              </View>
              )}
        </View>
      )}
    </View>
  )
}

export default FundingRoundDetail
