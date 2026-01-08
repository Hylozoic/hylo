import { Shapes, Plus } from 'lucide-react'
import React, { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { groupUrl, createTrackUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import TrackCard from 'components/TrackCard'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchGroupTracks, { FETCH_GROUP_TRACKS } from 'store/actions/fetchGroupTracks'
import { RESP_MANAGE_TRACKS } from 'store/constants'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getTracks from 'store/selectors/getTracksForGroup'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import isPendingFor from 'store/selectors/isPendingFor'

function Tracks () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useParams()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const canManageTracks = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_TRACKS, groupId: currentGroup?.id }))
  const tracksSettingsUrl = groupUrl(currentGroup.slug, 'settings/tracks')

  const tracks = useSelector(state => getTracks(state, { groupId: currentGroup.id }))
  const tracksToDisplay = useMemo(() => canManageTracks ? tracks : tracks.filter(track => track.publishedAt), [canManageTracks, tracks])

  const pending = useSelector(state => isPendingFor([FETCH_GROUP_TRACKS], state))

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
      {canManageTracks && (
        <div className='text-foreground text-center'>
          <Link to={createTrackUrl(routeParams)} className='flex justify-center items-center gap-1 text-foreground border-2 border-foreground/20 hover:border-foreground/50 rounded-lg py-1 px-2 transition-all hover:scale-105 hover:text-foreground group mb-4 mt-2'>
            <Plus className='w-4 h-4' />
            {t('Add a track')}
          </Link>
          <Link to={tracksSettingsUrl} className='text-accent'>
            {t('Go to tracks settings')}
          </Link>
        </div>
      )}
      {pending
        ? <Loading />
        : tracksToDisplay.length === 0 && (
          <h2 className='text-foreground text-center py-8'>
            {t('This group currently does not have any published tracks')}
          </h2>)}
      {tracksToDisplay.map(track => (
        <TrackCard key={track.id} track={track} />
      ))}
    </div>
  )
}

export default Tracks
