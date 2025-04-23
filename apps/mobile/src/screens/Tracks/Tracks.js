import React, { useEffect } from 'react'
import { View, FlatList } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useRoute } from '@react-navigation/native'
import { Shapes } from 'lucide-react-native'
import { useHeaderOptions } from 'navigation/utils'
import fetchGroupTracks from 'store/actions/fetchGroupTracks'
import { RESP_MANAGE_TRACKS } from 'store/constants'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useHasResponsibility from '@hylo/hooks/useHasResponsibility'
import getTracks from 'store/selectors/getTracksForGroup'
import TrackCard from 'components/TrackCard'

function Tracks() {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [{ currentGroup }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canManageTracks = hasResponsibility(RESP_MANAGE_TRACKS)

  const tracks = []
  // Replace with useGroupTracks

  // useEffect(() => {
  //   if (currentGroup?.id) {
  //     dispatch(fetchGroupTracks(currentGroup.id, {}))
  //   }
  // }, [currentGroup?.id])

  const renderTrack = ({ item: track }) => (
    <TrackCard track={track} />
  )

  return (
    <View className='flex-1 bg-background'>
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
