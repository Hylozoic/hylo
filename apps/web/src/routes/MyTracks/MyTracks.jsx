import { Shapes } from 'lucide-react'
import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import RoundImage from 'components/RoundImage'
import TrackCard from 'components/TrackCard'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchMyTracks, { FETCH_MY_TRACKS } from 'store/actions/fetchMyTracks'
import { makeGetQueryResults, makeQueryResultsModelSelector } from 'store/reducers/queryResults'

const getMyTracksResults = makeGetQueryResults(FETCH_MY_TRACKS)
const getMyTracks = makeQueryResultsModelSelector(getMyTracksResults, 'Track')

/** Parent (or space) group used to bucket My Tracks. */
function groupingGroupForTrack (track) {
  const space = track.space || track.ref?.space
  return space?.parentGroup || space || null
}

function MyTracks () {
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const fetchMyTracksParams = useMemo(() => ({ autocomplete: '', sortBy: 'name', order: 'asc' }), [])

  const tracks = useSelector(state => getMyTracks(state, fetchMyTracksParams))
  const tracksByGroup = useMemo(() => {
    return tracks.reduce((acc, track) => {
      const group = groupingGroupForTrack(track)
      if (!group?.id) return acc
      const trackData = { ...track.ref, space: track.space || track.ref?.space }
      acc[group.id] = [...(acc[group.id] || []), { ...trackData, groupingGroup: group }]
      return acc
    }, {})
  }, [tracks])

  useEffect(() => {
    dispatch(fetchMyTracks(fetchMyTracksParams))
  }, [])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('My Tracks'),
      search: true,
      icon: <Shapes />
    })
  }, [])

  return (
    <div className='p-4 max-w-[750px] mx-auto flex flex-col gap-2 mt-4'>
      {Object.entries(tracksByGroup).map(([groupId, groupTracks]) => (
        <div key={groupId} className='mb-4 border-2 border-dashed border-foreground/20 rounded-md p-4 py-6 flex flex-col gap-4 relative'>
          <span className='flex items-center gap-2 bg-midground rounded-md p-2 absolute -top-5 left-2'>
            <RoundImage url={groupTracks[0].groupingGroup.avatarUrl} small /> {groupTracks[0].groupingGroup.name}
          </span>
          {groupTracks.map(track => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default MyTracks
