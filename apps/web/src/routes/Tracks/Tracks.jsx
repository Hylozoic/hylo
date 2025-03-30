import { Shapes } from 'lucide-react'
import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchGroupTracks from 'store/actions/fetchGroupTracks'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getTracks from 'store/selectors/getTracksForGroup'
import TrackCard from 'components/TrackCard'

function Tracks () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useParams()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))

  const tracks = useSelector(state => getTracks(state, { groupId: currentGroup.id }))

  useEffect(() => {
    dispatch(fetchGroupTracks(currentGroup.id, {}))
  }, [currentGroup.id])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Tracks'),
      search: true,
      icon: <Shapes />
    })
  }, [])

  return (
    <div className='p-4'>
      {tracks.map(track => (
        <TrackCard key={track.id} track={track} />
      ))}
    </div>
  )
}

export default Tracks
