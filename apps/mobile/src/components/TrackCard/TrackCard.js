import React, { useCallback } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Users, UserCheck } from 'lucide-react-native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useHasResponsibility from '@hylo/hooks/useHasResponsibility'
import useOpenURL from 'hooks/useOpenURL'
import { groupUrl } from '@hylo/navigation'
import { RESP_MANAGE_TRACKS } from 'store/constants'

function TrackCard ({ track, groupSlug }) {
  const { t } = useTranslation()
  const [{ currentGroup }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canEdit = hasResponsibility(RESP_MANAGE_TRACKS)
  const openURL = useOpenURL()

  // const handlePublishTrack = useCallback((publishedAt) => {
  //   Alert.alert(
  //     t('Confirm'),
  //     publishedAt
  //       ? t('Are you sure you want to publish this track?')
  //       : t('Are you sure you want to unpublish this track?'),
  //     [
  //       {
  //         text: t('Cancel'),
  //         style: 'cancel'
  //       },
  //       {
  //         text: t('OK'),
  //         onPress: () => {}
  //       }
  //     ]
  //   )
  // }, [track.id])

  const { actionDescriptor, actionDescriptorPlural, name, numActions, numPeopleCompleted, numPeopleEnrolled, didComplete, isEnrolled } = track

  const navigateToTrack = () => {
    const trackUrl = `${groupUrl(groupSlug || currentGroup?.slug, 'tracks')}/${track.id}`

    openURL(trackUrl)
  }

  return (
    <Pressable
      onPress={navigateToTrack}
      className='mb-2'
    >
      <View className='rounded-xl p-2 flex flex-col bg-card/50 border-2 border-card/30'>
        <View className='flex flex-row justify-between items-center pb-1'>
          <Text className='text-base text-foreground font-medium' numberOfLines={1}>{name}</Text>
          <Text className='text-xs text-foreground/60 ml-2'>
            {t('{{num}} {{actionName}}', { num: numActions, actionName: numActions === 1 ? actionDescriptor : actionDescriptorPlural })}
          </Text>
        </View>

        <View className='flex-row justify-between items-center'>
          {canEdit && (
            <View className='flex-row items-center gap-x-2 bg-input p-2 rounded-md'>
              {/* <Button
                onPress={() => publishedAt ? handlePublishTrack(null) : null}
                className={clsx(
                  'w-8 h-8 items-center justify-center rounded-md',
                  publishedAt ? 'bg-foreground/10 text-foreground' : 'bg-accent text-white'
                )}
              >
                <EyeOff className='w-5 h-5' />
              </Button>

              <Button
                onPress={() => !publishedAt ? handlePublishTrack(new Date().toISOString()) : null}
                className={clsx(
                  'w-8 h-8 items-center justify-center rounded-md',
                  publishedAt ? 'bg-selected text-white' : 'bg-foreground/10 text-foreground'
                )}
              >
                <Eye className='w-5 h-5' />
              </Button>

              <Text className={clsx(
                'text-xs',
                publishedAt ? 'text-selected' : 'text-accent'
              )}>
                {publishedAt ? t('Published') : t('Unpublished')}
              </Text> */}
            </View>
          )}

          <View className='flex-row justify-end items-center gap-x-2'>
            <View className='flex-row items-center gap-x-1 border-2 border-focus/20 rounded-md p-1 px-2'>
              <Text className='text-foreground'>{numPeopleEnrolled}</Text>
              <Users className='w-4 h-4 text-foreground' />
            </View>

            <View className='flex-row items-center gap-x-1 border-2 border-selected/20 rounded-md p-1 px-2'>
              <Text className='text-foreground'>{numPeopleCompleted}</Text>
              <UserCheck className='w-4 h-4 text-foreground' />
            </View>

            {didComplete
              ? (
                <View>
                  <Text className='text-foreground'>{t('You completed this track')}</Text>
                </View>
                )
              : isEnrolled
                ? (
                  <View>
                    <Text className='text-foreground'>{t('You are enrolled')}</Text>
                  </View>
                  )
                : null}
          </View>
        </View>
      </View>
    </Pressable>
  )
}

export default TrackCard
