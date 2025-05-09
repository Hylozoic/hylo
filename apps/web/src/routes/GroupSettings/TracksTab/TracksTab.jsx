// import { set } from 'lodash'
import { Shapes, Plus } from 'lucide-react'

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

  // const updateSetting = (key, setChanged = true) => event => {
  //   set(settings, key, event.target.value)
  //   setChanged(setChanged ? true : changed)
  // }

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
      <div className='flex flex-col gap-2 mb-8'>
        <h1 className='m-0 p-0'>{t('tracksSettingsHeader')}</h1>
        <p className='m-0 p-0 text-foreground/60'>{t('tracksSettingsDescription')}</p>
      </div>
      {/* TODO: add this back <SettingsSection>
        <h3 className='text-sm absolute -top-[26px] left-3 left-0 bg-midground p-1'>{t('Customize your groups terminology')}</h3>
        <h4 className='font-bold'>{t('Tracks')}</h4>
        <p className='text-sm text-foreground/60'>{t('The default name for the container for a structured activity that people in the group can enroll in. A track has an about page, a chat, and a list of actions. Synonymous with courses, projects, learning journeys, modules, missions, workflows, roadmaps, cohorts, expeditions and curriculums. Anywhere the word “Track” would be used will be replaced with:')}</p>
        <p className='text-foreground'>{t('Your groups term for a track')}</p>
        <input type='text' className='border-2 border-transparent rounded-md p-2 bg-input shadow-md focus:outline-none focus:border-focus' value='Track' />
      </SettingsSection> */}

      <SettingsSection>
        <h3 className='text-sm absolute -top-[26px] left-3 left-0 bg-midground p-1'>{t('Tracks')}</h3>
        <div className='flex flex-col gap-2'>
          <Link to={createTrackUrl(routeParams)} className='flex justify-center items-center gap-1 text-foreground border-2 border-foreground/20 hover:border-foreground/100 rounded-lg py-1 px-2 transition-all hover:scale-105 hover:text-foreground group mb-4 mt-2'>
            <Plus className='w-4 h-4' />
            {t('Add a track')}
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
