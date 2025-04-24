import { Shapes } from 'lucide-react'
import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchGroupTracks from 'store/actions/fetchGroupTracks'
import { RESP_MANAGE_TRACKS } from 'store/constants'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getTracks from 'store/selectors/getTracksForGroup'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import TrackCard from 'components/TrackCard'
import { groupUrl } from 'util/navigation'

function Tracks () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useParams()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const canManageTracks = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_TRACKS, groupId: currentGroup?.id }))
  const tracksSettingsUrl = groupUrl(currentGroup.slug, 'settings/tracks')

  const tracks = useSelector(state => getTracks(state, { groupId: currentGroup.id }).filter(track => canManageTracks || track.publishedAt))

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
    <div className='p-4 max-w-[750px] mx-auto flex flex-col gap-2'>
      {tracks.length === 0 && (
        <h2 className='text-foreground text-center py-8'>
          {t('This group currently does not have any published tracks')}
        </h2>
      )}
      {tracks.length === 0 && canManageTracks && (
        <div className='text-foreground text-center'>
          {t('Create a track to get started')}
          <br />
          <a href={tracksSettingsUrl} className='text-accent'>
            {t('Go to tracks settings')}
          </a>
        </div>
      )}
      {tracks.map(track => (
        <TrackCard key={track.id} track={track} />
      ))}
    </div>
  )
}

export default Tracks
