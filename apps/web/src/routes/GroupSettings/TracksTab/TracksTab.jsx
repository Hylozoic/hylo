import { set } from 'lodash'
import { Shapes } from 'lucide-react'

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import fetchGroupTracks from 'store/actions/fetchGroupTracks'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getTracks from 'store/selectors/getTracksForGroup'
import TrackCard from 'components/TrackCard'
import SaveButton from '../SaveButton'
import SettingsSection from '../SettingsSection'
import { createTrackUrl } from 'util/navigation'

function TracksTab ({ group, fetchPending, parentGroups, updateGroupSettings }) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState(group.settings)
  const [changed, setChanged] = useState(false)

  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))

  const tracks = useSelector(state => getTracks(state, { groupId: currentGroup.id }))

  useEffect(() => {
    if (!fetchPending) {
      setSettings(group.settings)
    }
  }, [fetchPending])

  useEffect(() => {
    dispatch(fetchGroupTracks(currentGroup.id, {}))
  }, [currentGroup.id])

  const updateSetting = (key, setChanged = true) => event => {
    set(settings, key, event.target.value)
    setChanged(setChanged ? true : changed)
  }

  const save = async () => {
    setChanged(false)
    updateGroupSettings({ ...settings })
  }

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: `${t('Group Settings')} > ${t('Tracks')}`,
      icon: <Shapes />,
      info: ''
    })
  }, [])

  if (!group) return <Loading />

  return (
    <div>
      <h1>{t('tracksSettingsHeader')}</h1>
      <p>{t('tracksSettingsDescription')}</p>

      {/* <SettingsSection>
        <h3>{t('Customize Your Group\'s Terminology')}</h3>
      </SettingsSection> */}

      <SettingsSection>
        <h3>{t('Tracks')}</h3>
        <div className='p-4'>
          <Link to={createTrackUrl(routeParams)} className='block text-foreground border-2 border-foreground/20 hover:border-foreground/100 rounded-lg py-1 px-2 transition-all hover:scale-105 hover:text-foreground group mb-4'>
            {t('Add a track')}
            +
          </Link>
          {tracks.map(track => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      </SettingsSection>

      <SaveButton save={save} changed={changed} />
    </div>
  )
}

export default TracksTab
