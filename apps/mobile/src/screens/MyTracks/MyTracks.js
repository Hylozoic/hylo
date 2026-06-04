// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

import React, { useMemo } from 'react'
import { View, FlatList, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import useMyTracks from '@hylo/hooks/useMyTracks'
import TrackCard from 'components/TrackCard'
import StreamHeader from '../Stream/StreamHeader'
import Loading from 'components/Loading'
import Avatar from 'components/Avatar'

export default function MyTracks () {
  const { t } = useTranslation()
  const [tracks, { fetching, error }] = useMyTracks({ sortBy: 'name', order: 'asc' })

  const { groupedTracks, ungroupedTracks } = useMemo(() => {
    return tracks.reduce((acc, track) => {
      const group = track.groups?.[0]
      if (!group) {
        acc.ungroupedTracks.push(track)
      } else {
        acc.groupedTracks[group.id] = acc.groupedTracks[group.id] || { group, tracks: [] }
        acc.groupedTracks[group.id].tracks.push(track)
      }
      return acc
    }, { groupedTracks: {}, ungroupedTracks: [] })
  }, [tracks])

  if (error) {
    return (
      <Text className='text-error text-center py-4'>
        {t('Error loading tracks')}
        {error.message}
      </Text>
    )
  }

  if (fetching) return <Loading />

  if (tracks.length === 0) {
    return (
      <View className='flex-1 bg-background'>
        <StreamHeader
          name={t('My Tracks')}
          iconName='Shapes'
          postPrompt={false}
          streamType='my-tracks'
        />
        <Text className='text-foreground text-center py-4 font-bold text-lg'>
          {t('You are not enrolled in any tracks')}
        </Text>
      </View>
    )
  }

  const renderGroupSection = ({ item }) => {
    if (item.type === 'ungrouped') {
      return (
        <View className='mb-4'>
          <Text className='text-foreground font-bold text-lg mb-2'>
            {t('Other Tracks')}
          </Text>
          <View className='gap-y-2'>
            {item.tracks.map(track => (
              <TrackCard key={track.id} track={track} />
            ))}
          </View>
        </View>
      )
    }

    const { group, tracks: groupTracks } = item
    return (
      <View className='mb-4'>
        <View className='flex-row items-center mb-2 gap-1'>
          <Avatar
            avatarUrl={group.avatarUrl}
            size='small'
            className='mr-2'
          />
          <Text className='text-foreground font-bold text-lg'>
            {group.name}
          </Text>
        </View>
        <View className='gap-y-2'>
          {groupTracks.map(track => (
            <TrackCard key={track.id} track={track} groupSlug={group.slug} />
          ))}
        </View>
      </View>
    )
  }

  const sections = [
    ...Object.values(groupedTracks),
    ...(ungroupedTracks.length > 0 ? [{ type: 'ungrouped', tracks: ungroupedTracks }] : [])
  ]

  return (
    <View className='flex-1 bg-background'>
      <StreamHeader
        name={t('My Tracks')}
        iconName='Shapes'
        postPrompt={false}
        streamType='my-tracks'
      />
      <FlatList
        data={sections}
        renderItem={renderGroupSection}
        keyExtractor={(item) => item.type === 'ungrouped' ? 'ungrouped' : item.group.id}
        contentContainerClassName='p-4'
      />
    </View>
  )
}
