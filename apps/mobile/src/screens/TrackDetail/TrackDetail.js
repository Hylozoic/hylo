// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Animated, Platform } from 'react-native'
// DEPRECATED: lucide-react-native removed
// import { DoorOpen, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { DateTimeHelpers, TextHelpers } from '@hylo/shared'
import useOpenURL from 'hooks/useOpenURL'
import { groupUrl, personUrl } from '@hylo/navigation'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useTrack from '@hylo/hooks/useTrack'
import useTracks from '@hylo/hooks/useTracks'
import useTrackEnrollment from '@hylo/hooks/useTrackEnrollment'
import HyloHTML from 'components/HyloHTML'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'
import useRouteParams from 'hooks/useRouteParams'

const sixMinutes = 6 * 60 * 1000

const TabButton = ({ isSelected, onPress, children }) => (
  <TouchableOpacity
    className={`py-1 px-4 rounded-md border-2 ${
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

const AboutTab = ({ trackDetail }) => {
  const { t } = useTranslation()
  const { bannerUrl, name, description } = trackDetail

  return (
    <ScrollView
      className='flex-1'
      showsVerticalScrollIndicator
    >
      <View className={`mt-4 w-full rounded-xl h-[40vh] items-center justify-center bg-foreground/20 ${Platform.OS === 'ios' ? 'shadow-2xl' : ''}`}>
        {bannerUrl && (
          <Image
            source={{ uri: bannerUrl }}
            className='absolute w-full h-full rounded-xl'
            resizeMode='cover'
          />
        )}
        <Text className='text-white text-4xl font-bold'>{name}</Text>
      </View>

      <View className='flex-1 mt-4'>
        <HyloHTML html={TextHelpers.markdown(description)} />
        <View className='h-20' />
      </View>
    </ScrollView>
  )
}

const ActionsTab = ({ trackDetail, posts = [], groupSlug }) => {
  const openURL = useOpenURL()

  const handlePostPress = (post) => {
    const baseUrl = groupUrl(groupSlug, 'tracks')
    const postUrl = post.completionAction === 'uploadFile'
      ? `${baseUrl}/${trackDetail.id}/upload-action/${post.id}`
      : `${baseUrl}/${trackDetail.id}/post/${post.id}`
    openURL(postUrl)
  }

  return (
    <ScrollView
      className='flex-1'
      contentContainerClassName='py-4 gap-y-4'
      showsVerticalScrollIndicator={false}
    >
      <Text className='text-xl mb-4'>{trackDetail.actionDescriptorPlural}</Text>
      {posts.map(post => (
        <TouchableOpacity
          key={post.id}
          activeOpacity={0.6}
          delayPressIn={50}
          onPress={() => handlePostPress(post)}
        >
          <PostCard
            post={post}
            isCurrentAction={trackDetail.currentAction?.id === post.id}
            onPress={() => handlePostPress(post)}
          />
        </TouchableOpacity>
      ))}
      <View className='h-20' />
    </ScrollView>
  )
}

const PeopleTab = ({ trackDetail, group }) => {
  const { t } = useTranslation()
  const openURL = useOpenURL()
  const { enrolledUsers } = trackDetail

  return (
    <ScrollView
      className='flex-1'
      contentContainerClassName='py-4'
      showsVerticalScrollIndicator={false}
    >
      <Text className='text-xl mb-4'>
        {enrolledUsers?.length
          ? t('{{numPeopleEnrolled}} people enrolled', { numPeopleEnrolled: enrolledUsers?.length })
          : t('No one is enrolled in this track')}
      </Text>

      {enrolledUsers?.length > 0 && (
        <View className='gap-y-4'>
          {enrolledUsers?.map(user => (
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
              <View>
                <Text className='text-sm text-foreground/60'>
                  {t('Enrolled {{date}}', { date: DateTimeHelpers.formatDatePair({ start: user.enrolledAt, skipTime: true }) })}
                </Text>
                {user.completedAt && (
                  <Text className='text-sm text-foreground/60'>
                    {t('Completed {{date}}', { date: DateTimeHelpers.formatDatePair({ start: user.completedAt, skipTime: true }) })}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
      <View className='h-20' />
    </ScrollView>
  )
}

// Might allow publish/unpublish from mobile...

// const EditTab = ({ currentTrack, posts = [], onAddAction, onOpenSettings }) => {
//   const { t } = useTranslation()

//   return (
//     <View className='flex-1'>
//       <TouchableOpacity
//         className='w-full border-2 border-foreground/20 px-4 py-2 rounded-md flex-row items-center gap-2 justify-center mt-4 mb-4'
//         onPress={onOpenSettings}
//       >
//         <Settings className='w-4 h-4' />
//         <Text>{t('Open Track Settings', { actionName: currentTrack.actionsName.slice(0, -1) })}</Text>
//       </TouchableOpacity>

//       {posts.map(post => (
//         <PostCard key={post.id} post={post} />
//       ))}

//       <TouchableOpacity
//         className='w-full border-2 border-foreground/20 px-4 py-2 rounded-md items-center mt-4'
//         onPress={onAddAction}
//       >
//         <Text>+ {t('Add {{actionName}}', { actionName: currentTrack.actionsName.slice(0, -1) })}</Text>
//       </TouchableOpacity>
//     </View>
//   )
// }

function TrackDetail() {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const [{ currentGroup }] = useCurrentGroup()
  const [{ currentUser }] = useCurrentUser()
  const [tracks, { fetching: fetchingTracks }] = useTracks({
    groupId: currentGroup?.id
  })
  const [trackDetail, { fetching, error }, requeryTrack] = useTrack({
    trackId: routeParams.trackId
  })

  // Find the track in the tracks list to get early access to isEnrolled
  const initialTrack = tracks?.find(t => t.id === routeParams.trackId)
  const [currentTab, setCurrentTab] = useState(initialTrack?.isEnrolled ? 'actions' : 'about')

  // Get current user's enrollment date
  const currentUserEnrollment = trackDetail?.enrolledUsers?.find(user => user.id === currentUser?.id)
  const enrolledAt = currentUserEnrollment?.enrolledAt


  const {
    enrollInTrack,
    leaveTrack,
    enrolling,
    leaving,
    error: enrollmentError
  } = useTrackEnrollment()

  // Animation values
  const [tabAnimation] = useState(new Animated.Value(0))
  const [welcomeAnimation] = useState(new Animated.Value(0))

  useEffect(() => {
    if (trackDetail?.isEnrolled) {
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
  }, [trackDetail?.isEnrolled])

  useEffect(() => {
    if (trackDetail?.isEnrolled && enrolledAt && Date.now() - new Date(enrolledAt).getTime() < sixMinutes) {
      // Animate welcome message in
      Animated.spring(welcomeAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7
      }).start()
    } else {
      // Animate welcome message out
      Animated.spring(welcomeAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7
      }).start()
    }
  }, [trackDetail?.isEnrolled, enrolledAt])

  if (fetching && trackDetail?.posts?.length === 0) return <Loading />
  if (fetching && !trackDetail) return <Loading />
  if (error || enrollmentError) {
    return (
      <Text className='text-error text-center py-4'>
        {t('Error loading track')}
      </Text>
    )
  }
  if (!trackDetail && !fetching) {
    return (
      <Text className='text-error text-center py-4'>
        {t('Track not found')}
      </Text>
    )
  }

  const handleEnroll = async () => {
    const success = await enrollInTrack(trackDetail.id)
    if (!success) {
      Alert.alert(
        t('Error'),
        t('Failed to enroll in track'),
        [{ text: t('Ok') }]
      )
    }
  }

  const handleLeave = async () => {
    const success = await leaveTrack(trackDetail.id)
    if (!success) {
      Alert.alert(
        t('Error'),
        t('Failed to leave track'),
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

  const welcomeAnimatedStyle = {
    opacity: welcomeAnimation,
    transform: [{
      translateY: welcomeAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [50, 0] // Slide up from 50 units below
      })
    }]
  }

  return (
    <View className='flex-1 bg-background'>
      <View className='flex-1 px-4 mt-2'>
        <View className='max-w-[750px] mx-auto flex-1 w-full'>
          {trackDetail?.isEnrolled && (
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
                  isSelected={currentTab === 'actions'}
                  onPress={() => {
                    setCurrentTab('actions')
                    requeryTrack({ requestPolicy: 'network-only' })
                  }}
                >
                  {trackDetail.actionDescriptorPlural}
                </TabButton>

                <TabButton
                  isSelected={currentTab === 'people'}
                  onPress={() => setCurrentTab('people')}
                >
                  {t('People')}
                </TabButton>
              </View>
            </Animated.View>
          )}

          {currentTab === 'about' && (
            <AboutTab
              trackDetail={trackDetail}
            />
          )}

          {currentTab === 'actions' && (
            <ActionsTab
              trackDetail={trackDetail}
              posts={trackDetail?.posts || []}
              groupSlug={currentGroup?.slug}
            />
          )}

          {currentTab === 'people' && (
            <PeopleTab
              trackDetail={trackDetail}
              group={currentGroup}
            />
          )}
        </View>
      </View>

      {currentTab === 'about' && (
        <View className='absolute bottom-0 left-0 right-0 bg-background shadow-lg'>
          { trackDetail?.isEnrolled && enrolledAt && Date.now() - new Date(enrolledAt).getTime() < sixMinutes && (
            <Animated.View
              style={welcomeAnimatedStyle}
              className='w-full'
            >
              <View className='flex-row gap-2 w-full px-4 py-2 justify-between items-center bg-input'>
                <ScrollView
                  className='flex-1'
                  style={{ maxHeight: 120 }}
                  showsVerticalScrollIndicator
                >
                  <Text className='text-foreground font-bold mb-2'>{t('Welcome Message')}</Text>
                  <HyloHTML html={TextHelpers.markdown(trackDetail.welcomeMessage)} />
                </ScrollView>
              </View>
            </Animated.View>
          )}
          {trackDetail.didComplete ? (
            <View className='flex-row gap-2 w-full px-4 py-2 justify-between items-center bg-input'>
              <Text className='text-foreground'>{t('You completed this track')}</Text>
            </View>
          ) : !trackDetail.isEnrolled ? (
            <View className='flex-row gap-2 w-full px-4 py-2 justify-between items-center bg-input'>
              <Text>{t('Ready to jump in?')}</Text>
              <TouchableOpacity
                className='bg-selected rounded-md p-2 px-4'
                onPress={handleEnroll}
                disabled={enrolling}
              >
                <Text className='text-foreground'>
                  {enrolling ? t('Enrolling-ellipsis') : t('Enroll')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className='flex-row gap-2 m-4 border-2 border-foreground/20 rounded-md p-2 justify-between items-center'>
              <View className='flex-row gap-2 items-center'>
                <Check />
                <Text>{t('You are currently enrolled in this track')}</Text>
              </View>
              <TouchableOpacity
                className='border-2 border-foreground/20 flex-row gap-2 items-center rounded-md p-2 px-4'
                onPress={handleLeave}
                disabled={leaving}
              >
                <DoorOpen className='w-4 h-4' />
                <Text>
                  {leaving ? t('Leaving...') : t('Leave Track')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export default TrackDetail
