import React from 'react'
import { View, FlatList, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { RESP_MANAGE_TRACKS } from 'store/constants'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useHasResponsibility from '@hylo/hooks/useHasResponsibility'
import useTracks from '@hylo/hooks/useTracks'
import TrackCard from 'components/TrackCard'
import StreamHeader from '../Stream/StreamHeader'
import Loading from 'components/Loading'

function Tracks() {
  const { t } = useTranslation()
  const [{ currentGroup }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canManageTracks = hasResponsibility(RESP_MANAGE_TRACKS)
  const [tracks, { fetching, error }] = useTracks({ 
    groupId: currentGroup?.id,
    hideUnpublished: !canManageTracks
  })
  if (error) return (
    <Text className='text-error text-center py-4'>
      {t('Error loading tracks')}
    </Text>
  )

  const renderTrack = ({ item: track }) => (
    <TrackCard track={track} />
  )

  return (
    <View className='flex-1 bg-background'>
      <StreamHeader
        name={t('Tracks')}
        image={currentGroup.bannerUrl ? { uri: currentGroup.bannerUrl } : null}
        iconName='Shapes'
        currentGroup={currentGroup}
        postPrompt={false}
        streamType='tracks'
      />
      {fetching && <Loading />}
      {tracks.length === 0 && !fetching && (
        <Text className='text-foreground text-center py-4 font-bold text-lg'>
          {t('This group currently does not have any published tracks')}
        </Text>
      )}
      {tracks.length === 0 && canManageTracks && !fetching && (
        <Text className='text-foreground text-center py-2 font-bold text-lg'>
          {t('Tracks can be created by admins in the web app for Hylo')}
        </Text>
      )}
      <FlatList
        data={tracks}
        renderItem={renderTrack}
        keyExtractor={track => track.id}
        contentContainerClassName='p-4 gap-y-2'
      />
    </View>
  )
}

export default Tracks
