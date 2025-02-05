import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import Loading from 'components/Loading'
import Icon from 'components/Icon'
import SettingsControl from 'components/SettingsControl'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import {
  fetchResponsibilitiesForGroup,
  addGroupResponsibility,
  deleteGroupResponsibility,
  updateGroupResponsibility
} from 'store/actions/responsibilities'
import SettingsSection from '../SettingsSection'

import general from '../GroupSettings.module.scss' // eslint-disable-line no-unused-vars
import styles from './ResponsibilitiesTab.module.scss'

const emptyResponsiblity = {
  description: '',
  title: '',
  draft: true,
  type: 'group'
}

const validateResponsibility = ({ title }) => {
  if (title.length < 3) return false
  return true
}

export default function ResponsibilitiesTab ({ group }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [responsibilities, setResponsibilities] = useState([])

  useEffect(() => {
    dispatch(fetchResponsibilitiesForGroup({ groupId: group.id }))
      .then((response) => {
        setResponsibilities(response.payload.data.responsibilities)
      })
  }, [])

  const handleAddResponsibility = () => {
    responsibilities.push({ ...emptyResponsiblity })
    setResponsibilities([...responsibilities])
  }

  const deleteUnsavedResponsibility = (i) => () => {
    if (window.confirm(t('Are you sure you want to delete this responsibility?'))) {
      const newResponsiblities = [...responsibilities]
      newResponsiblities.splice(i, 1)
      setResponsibilities(newResponsiblities)
    }
  }

  const deleteSavedResponsibility = (i) => () => {
    const newResponsbilities = [...responsibilities]
    const responsbility = { ...newResponsbilities[i] }
    if (window.confirm(`${t('Are you sure you want to delete this responsibility?')}`)) {
      dispatch(deleteGroupResponsibility({ groupId: group?.id, responsibilityId: responsbility.id })).then((response) => {
        newResponsbilities.splice(i, 1)
        setResponsibilities(newResponsbilities)
      })
    }
  }

  const updateLocalResponsibility = (i) => (key) => (v) => {
    const value = typeof (v.target) !== 'undefined' ? v.target.value : v
    const responsbility = { ...responsibilities[i] }
    if (responsbility.changed !== true) responsbility.originalState = { ...responsbility }
    responsbility[key] = value
    responsbility.changed = true
    const newResponsbilities = [...responsibilities]
    newResponsbilities[i] = responsbility
    setResponsibilities(newResponsbilities)
  }

  const saveResponsibility = (i) => () => {
    const responsbility = { ...responsibilities[i] }
    if (validateResponsibility(responsbility)) {
      dispatch(addGroupResponsibility({ ...responsbility, groupId: group?.id })).then((response) => {
        const newResponsbilities = [...responsibilities]
        newResponsbilities[i] = { ...response.payload.data.addGroupResponsibility }
        setResponsibilities(newResponsbilities)
      })
    } else {
      window.alert(t('A responsibility must have a title over three characters long to be saved'))
    }
  }

  const resetResponsibility = (i) => () => {
    const responsbility = { ...responsibilities[i] }
    const newResponsbilities = [...responsibilities]
    newResponsbilities[i] = { ...responsbility.originalState }
    setResponsibilities(newResponsbilities)
  }

  const updateResponsibility = (i) => () => {
    const responsbility = { ...responsibilities[i] }
    if (validateResponsibility(responsbility)) {
      dispatch(updateGroupResponsibility({ ...responsbility, groupId: group?.id, responsibilityId: responsbility.id })).then((response) => {
        const newResponsbilities = [...responsibilities]
        newResponsbilities[i] = { ...response.payload.data.updateGroupResponsibility }
        setResponsibilities(newResponsbilities)
      })
    } else {
      window.alert(t('A responsibility must have at least three characters for its title'))
    }
  }

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: `${t('Group Settings')} > ${t('Responsibilities')}`,
      icon: 'Settings',
      info: ''
    })
  }, [])

  const unsavedRolePresent = responsibilities.length > 0 ? responsibilities[responsibilities.length - 1]?.draft : false

  if (!responsibilities) return <Loading />

  return (
    <>
      <h2 className='text-foreground'>{t('Platform Responsibilities')}</h2>
      {/* Is this i18n weirdly busted? */}
      <p className='text-foreground mb-8 text-sm'>{t('adminResponsibilitiesHelpText')}</p>
      <SettingsSection>
        {/* <div className={styles.helpText}>{t('Each of these responsibilities gives access to specific functionality related to the platform')}</div> */}
        {responsibilities && responsibilities.map((role, i) => (
          <ResponsibilityRow
            group={group}
            key={i}
            index={i}
            t={t}
            {...role}
            showType='system'
          />
        ))}
      </SettingsSection>
      <h2 className='text-foreground mt-14'>{t('Custom Responsibilities')}</h2>
      <p className='text-foreground mb-8 text-sm'>{t('adminResponsibilitiesCustomHelpText')}</p>
      <SettingsSection>
        {responsibilities && responsibilities.map((role, i) => (
          <ResponsibilityRow
            group={group}
            key={i}
            index={i}
            t={t}
            {...role}
            showType='group'
            onChange={updateLocalResponsibility(i)}
            onSave={saveResponsibility(i)}
            onUpdate={updateResponsibility(i)}
            onDelete={deleteUnsavedResponsibility(i)}
            onServerDelete={deleteSavedResponsibility(i)}
            onReset={resetResponsibility(i)}
          />
        ))}
        {!unsavedRolePresent && (
          <button className='focus:text-foreground text-base border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center justify-center gap-2' onClick={handleAddResponsibility}>
            <span>{t('Create new responsibility')}</span>
            <Icon name='Circle-Plus' className='text-foreground h-[20px]'/>
          </button>
        )}
      </SettingsSection>
    </>
  )
}

function ResponsibilityRow ({
  changed,
  draft = false,
  description,
  title,
  onChange,
  onDelete,
  onServerDelete,
  onReset,
  onSave,
  onUpdate,
  showType,
  type,
  t
}) {
  const inactiveStyle = draft ? styles.inactive : ''
  if (showType !== type) return null
  return (
    <div className={cn('bg-foreground/5 mb-2 rounded-lg p-2')}>
      <div className='flex'>
        {draft && (<span onClick={onDelete}><Icon name='CircleEx' /> {t('Cancel')}</span>)}
        {!draft && type !== 'system' && !changed && (<span onClick={onServerDelete}><Icon name='Trash' /> {t('Delete')}</span>)}
        {draft && <span className={styles.action} onClick={onSave}><Icon name='Plus' /> {t('Create')}</span>}
        {!draft && changed && (<span onClick={onUpdate}><Icon name='Unlock' /> {t('Save')}</span>)}
        {!draft && changed && (<span  onClick={onReset}><Icon name='Back' /> {t('Revert')}</span>)}
      </div>
      {type === 'group' &&
        <div className={styles.responsibilityRow}>
          <div className={styles.responsibilityStack}>
            <SettingsControl label='Title' onChange={onChange('title')} value={title} />
            <SettingsControl label='Description' onChange={onChange('description')} value={description} type='textarea' />
          </div>
        </div>}
      {type === 'system' &&
        <div className='flex flex-col'>
          <div className={styles.systemResponsibilityStack}>
            <h5 className='m-0 bold'>{title}</h5>
            <span className='text-foreground text-sm opacity-50'>{description}</span>
          </div>
        </div>}
    </div>
  )
}
