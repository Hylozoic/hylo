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

function MyTracks () {
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const fetchMyTracksParams = useMemo(() => ({ autocomplete: '', sortBy: 'name', order: 'asc' }), [])

  const tracks = useSelector(state => getMyTracks(state, fetchMyTracksParams))
  const tracksByGroup = useMemo(() => {
    return tracks.reduce((acc, track) => {
      const group = track.groups?.toModelArray()[0]
      acc[group.id] = [...(acc[group.id] || []), { ...track.ref, groups: track.groups?.toModelArray() }]
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
    <div className='p-4 max-w-[750px] mx-auto flex flex-col gap-2'>
      {Object.entries(tracksByGroup).map(([groupId, tracks]) => (
        <div key={groupId} className='mb-4'>
          <span className='flex items-center gap-2'>
            <RoundImage url={tracks[0].groups[0].avatarUrl} small /> {tracks[0].groups[0].name}
          </span>
          {tracks.map(track => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default MyTracks
