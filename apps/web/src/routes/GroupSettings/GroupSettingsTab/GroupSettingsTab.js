import { set, trim } from 'lodash'
import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { TextHelpers } from '@hylo/shared'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import { ImageUp, Info } from 'lucide-react'
import { ensureLocationIdIfCoordinate } from 'components/LocationInput/LocationInput.store'
import EditableMap from 'components/Map/EditableMap/EditableMap'
import EditableMapModal from 'components/Map/EditableMap/EditableMapModal'
import SettingsControl from 'components/SettingsControl'
import SkillsSection from 'components/SkillsSection'
import SwitchStyled from 'components/SwitchStyled'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { setConfirmBeforeClose } from 'routes/FullPageModal/FullPageModal.store'
import {
  DEFAULT_BANNER,
  DEFAULT_AVATAR,
  LOCATION_PRECISION
} from 'store/models/Group'
import { bgImageStyle, cn } from 'util/index'
import SettingsSection from '../SettingsSection'

import general from '../GroupSettings.module.scss'

const { object, func } = PropTypes

function GroupSettingsTab ({ currentUser, group, fetchLocation, fetchPending, updateGroupSettings }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [state, setState] = useState(defaultEditState())

  useEffect(() => {
    if (!fetchPending) {
      setState(defaultEditState())
    }
  }, [fetchPending])

  function defaultEditState () {
    if (!group) return { edits: {}, changed: false, valid: false }

    const {
      aboutVideoUri, avatarUrl, bannerUrl, description, geoShape, location, locationObject, name, settings, websiteUrl
    } = group

    return {
      edits: {
        aboutVideoUri: (aboutVideoUri && trim(aboutVideoUri)) || '',
        avatarUrl: avatarUrl || DEFAULT_AVATAR,
        bannerUrl: bannerUrl || DEFAULT_BANNER,
        description: description || '',
        geoShape: geoShape && typeof geoShape !== 'string' ? JSON.stringify(geoShape) || '' : geoShape || '',
        location: location || '',
        locationId: locationObject ? locationObject.id : '',
        stewardDescriptor: group.stewardDescriptor || t('Moderator'),
        stewardDescriptorPlural: group.stewardDescriptorPlural || t('Moderators'),
        name: name || '',
        purpose: group.purpose || '',
        settings: typeof settings !== 'undefined' ? settings : { },
        websiteUrl
      },
      error: null,
      changed: false,
      isModal: false,
      postTypesModalOpen: false
    }
  }

  const updateSetting = (key, setChanged = true) => event => {
    const { edits, changed } = state

    if (key === 'location') {
      edits.location = event.target.value.fullText
      edits.locationId = event.target.value.id
    } else if (key === 'websiteUrl') {
      edits.websiteUrl = TextHelpers.sanitizeURL(event.target.value)
    } else {
      set(edits, key, event.target.value)
    }

    dispatch(setConfirmBeforeClose(true))

    setState({
      changed: setChanged ? true : changed,
      edits: { ...edits }
    })
  }

  const updateSettingDirectly = (key, changed) => value =>
    updateSetting(key, changed)({ target: { value } })

  const savePolygon = (polygon) => {
    const { edits } = state
    setState({
      changed: true,
      edits: { ...edits, geoShape: polygon?.features?.length > 0 ? JSON.stringify(polygon.features[polygon.features.length - 1].geometry) : null }
    })
  }

  const toggleModal = () => {
    setState(prevState => ({
      ...prevState,
      isModal: !prevState.isModal
    }))
  }

  const save = async () => {
    setState(prevState => ({ ...prevState, changed: false }))
    let locationId = state.edits.locationId
    if (group && state.edits.location !== group.location) {
      locationId = await ensureLocationIdIfCoordinate({ fetchLocation, location: state.edits.location, locationId })
    }
    updateGroupSettings({ ...state.edits, locationId })
    dispatch(setConfirmBeforeClose(false))
  }

  function saveButtonContent () {
    const { changed, error } = state
    if (!changed) return { color: 'gray', style: '', text: t('Current settings up to date') }
    if (error) {
      return { color: 'purple', style: 'general.settingIncorrect', text: error }
    }
    return { color: 'green', style: 'general.settingChanged', text: t('Changes not saved') }
  }

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Group Settings'),
      icon: 'Settings',
      info: ''
    })
  }, [])

  if (!group) return <Loading />

  const { changed, edits, error } = state
  const {
    aboutVideoUri, avatarUrl, bannerUrl, description, geoShape, location, stewardDescriptor, stewardDescriptorPlural, name, purpose, settings, websiteUrl
  } = edits

  const { locationDisplayPrecision, showSuggestedSkills } = settings
  const editableMapLocation = group?.locationObject || currentUser.locationObject

  t('Show my groups exact location')
  t('Display only nearest city and show nearby location on the map')
  t('Display only nearest city and dont show on the map')

  return (
    <div className='w-full flex flex-col'>
      <div className='w-full h-[30vh] bg-background mb-[50px]'>
        <UploadAttachmentButton
          type='groupBanner'
          id={group.id}
          onSuccess={({ url }) => updateSettingDirectly('bannerUrl')(url)}
          className='relative z-0'
        >
          <div style={bgImageStyle(bannerUrl)} className='w-full group h-[30vh] hover:scale-105 rounded-xl transition-all relative z-0 hover:scale-105 shadow-xl hover:shadow-2xl'>
            <div className='absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[100px] h-[100px] bg-black/60 opacity-0 group-hover:opacity-100 transition-all rounded-xl text-xs flex flex-col justify-center items-center text-center'>
              <ImageUp className='w-[30px] h-[30px]' />
              <div>{t('Change group banner')}</div>
            </div>
          </div>
        </UploadAttachmentButton>
        <UploadAttachmentButton
          type='groupAvatar'
          id={group.id}
          onSuccess={({ url }) => updateSettingDirectly('avatarUrl')(url)}
          className='relative z-1 bg-background w-full'
        >
          <div style={bgImageStyle(avatarUrl)} className='w-[100px] group h-[100px] rounded-xl bg-cover absolute top-[-50px] left-[50%] translate-x-[-50%] flex justify-center items-center shadow-xl hover:shadow-2xl hover:scale-105 transition-all'>
            <div className='absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[100px] h-[100px] bg-black/60 opacity-0 group-hover:opacity-100 transition-all rounded-xl text-xs flex flex-col justify-center items-center text-center'>
              <ImageUp className='w-[30px] h-[30px]' />
              <div>{t('Change group icon')}</div>
            </div>
          </div>
        </UploadAttachmentButton>
      </div>
      <div className='w-full flex justify-center items-center mt-2 mb-1'>
        <input
          type='text'
          onChange={updateSetting('name')}
          value={name || ''} id='nameField'
          className='w-full bg-transparent text-foreground text-center text-2xl font-bold outline-none focus:border-2 focus:border-dashed focus:border-foreground/80 rounded-lg hover:scale-105 transition-all hover:border-2 hover:border-foreground/50 border-dashed border-2 border-transparent hover:border-dashed'
        />
      </div>

      <SettingsControl
        helpText={t('purposeHelpText')}
        label={t('Purpose Statement')}
        maxLength='500'
        onChange={updateSetting('purpose')}
        type='textarea'
        value={purpose}
      />
      <SettingsControl label={t('Description')} onChange={updateSetting('description')} value={description} type='textarea' id='descriptionField' />
      <SettingsControl label={t('Website URL')} onChange={updateSetting('websiteUrl')} value={websiteUrl} />
      <SettingsControl label={t('About Video URL')} onChange={updateSetting('aboutVideoUri')} value={aboutVideoUri} />
      <SettingsSection>
        <h3 className='text-foreground text-xl mb-4 mt-0'>{t('Location Settings')}</h3>
        <SettingsControl
          label={t('Group Location')}
          onChange={updateSettingDirectly('location', true)}
          location={location}
          locationObject={group.locationObject}
          type='location'
        />
        <div className='mb-5'>
          <label className='w-full text-foreground/50 text-sm mb-2 block'>{t('Display location')}</label>
          <Dropdown
            className='bg-black/20 rounded-lg text-foreground w-full p-4 outline-none focus:outline-focus focus:outline-2 text-base'
            toggleChildren={(
              <span className='text-base w-full flex justify-between'>
                {LOCATION_PRECISION[locationDisplayPrecision || 'precise']}
                <Icon name='ArrowDown' />
              </span>
            )}
            items={Object.keys(LOCATION_PRECISION).map(value => ({
              label: t(LOCATION_PRECISION[value]),
              onClick: () => updateSettingDirectly('settings.locationDisplayPrecision')(value)
            }))}
          />
          <p className='text-sm opacity-50 flex items-center'>
            <Info className='h-[16px]' />
            {t('Administrators will always see exact location')}
          </p>
        </div>
        <SettingsControl
          label={t('Define your regional boundary')}
          onChange={updateSetting('geoShape')}
          placeholder={t('Paste GeoJSON here or draw on the map below')}
          type='text'
          value={geoShape || ''}
        />
        <div className='w-full h-[275px] rounded-lg overflow-hidden'>
          {state.isModal
            ? (
              <EditableMapModal group={group} toggleModal={toggleModal}>
                <EditableMap
                  locationObject={editableMapLocation}
                  polygon={geoShape}
                  savePolygon={savePolygon}
                  toggleModal={toggleModal}
                />
              </EditableMapModal>
              )
            : (
              <EditableMap
                locationObject={editableMapLocation}
                polygon={geoShape}
                savePolygon={savePolygon}
                toggleModal={toggleModal}
              />
              )}
        </div>
      </SettingsSection>
      <SettingsSection>
        <h3 className='text-foreground text-xl mb-4 mt-0'>{t('Customize group terms')}</h3>
        <SettingsControl
          label={t('Word used to describe a group Steward')}
          onChange={updateSetting('stewardDescriptor')}
          value={stewardDescriptor}
        />
        <SettingsControl
          label={t('Plural word used to describe group Stewards')}
          onChange={updateSetting('stewardDescriptorPlural')}
          value={stewardDescriptorPlural}
        />
      </SettingsSection>

      <SettingsSection>
        <div className='pb-[30px]'>
          <h3 className='text-foreground text-xl mb-4 mt-0'>{t('Relevant skills & interests')}</h3>
          <p className='text-foreground text-base'>{t('What skills and interests are particularly relevant to this group?')}</p>

          <SkillsSection
            group={group}
            label={t('Add a relevant skill or interest')}
            placeholder={t('What skills and interests are most relevant to your group?')}
          />

          <div className={cn('absolute bottom-0 left-0 w-full bg-foreground/10', { [general.on]: showSuggestedSkills })}>
            <div className='w-full h-[40px] flex items-center p-2 justify-between'>
              <div>
                <SwitchStyled
                  checked={showSuggestedSkills}
                  onChange={() => updateSettingDirectly('settings.showSuggestedSkills')(!showSuggestedSkills)}
                  backgroundColor={showSuggestedSkills ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
                />
                <span className='text-foreground text-sm pl-2'>{t('Ask new members whether they have these skills and interests?')}</span>
              </div>
              <div className={general.onOff}>
                <div className={general.off}>{t('OFF')}</div>
                <div className={general.on}>{t('ON')}</div>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>
      <div className={cn(
        'sticky bottom-4 left-[50%] translate-x-[-50%] w-[60%] bg-background/80 rounded-xl p-4 flex justify-between items-center translate-y-[200px] transition-all opacity-0 scale-0',
        {
          'border-2 border-accent border-dashed text-accent translate-y-[0px] opacity-100 scale-100': changed
        })}
      >
        <span className={saveButtonContent().style}>{saveButtonContent().text}</span>
        <button onClick={changed && !error ? save : null} className='bg-foreground rounded text-background py-1 px-2 text-bold'>
          {t('Save Changes')}
        </button>
      </div>
    </div>
  )
}

GroupSettingsTab.propTypes = {
  currentUser: object,
  group: object,
  fetchLocation: func,
  fetchPending: object,
  updateGroupSettings: func
}

export default GroupSettingsTab
