import { set, trim } from 'lodash'
import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
import { withTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Button from 'components/Button'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
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
import styles from './GroupSettingsTab.module.scss'

const { object, func } = PropTypes

function GroupSettingsTab ({ currentUser, group, fetchLocation, fetchPending, updateGroupSettings, transitionGroupToNewMenu, t }) {
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
      aboutVideoUri, avatarUrl, bannerUrl, description, geoShape, location, locationObject, name, settings
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
        settings: typeof settings !== 'undefined' ? settings : { }
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
    aboutVideoUri, avatarUrl, bannerUrl, description, geoShape, location, stewardDescriptor, stewardDescriptorPlural, name, purpose, settings
  } = edits

  const { locationDisplayPrecision, showSuggestedSkills } = settings
  const editableMapLocation = group?.locationObject || currentUser.locationObject

  t('Display exact location')
  t('Display only nearest city and show nearby location on the map')
  t('Display only nearest city and dont show on the map')

  return (
    <div className={general.groupSettings}>
      <span className={styles.nameBox}>
        <label className={styles.label} htmlFor='nameField'>{t('Group Name')}</label>
        <input type='text' className={styles.name} onChange={updateSetting('name')} value={name || ''} id='nameField' />
      </span>
      <label className={styles.label}>{t('Banner and Avatar Images')}</label>
      <UploadAttachmentButton
        type='groupBanner'
        id={group.id}
        onSuccess={({ url }) => updateSettingDirectly('bannerUrl')(url)}
        className={styles.changeBanner}
      >
        <div style={bgImageStyle(bannerUrl)} className={styles.bannerImage}>
          <Icon name='AddImage' className={styles.uploadIcon} />
        </div>
      </UploadAttachmentButton>
      <UploadAttachmentButton
        type='groupAvatar'
        id={group.id}
        onSuccess={({ url }) => updateSettingDirectly('avatarUrl')(url)}
        className={styles.changeAvatar}
      >
        <div style={bgImageStyle(avatarUrl)} className={styles.avatarImage}>
          <Icon name='AddImage' className={styles.uploadIcon} />
        </div>
      </UploadAttachmentButton>
      <SettingsControl
        helpText={t('purposeHelpText')}
        label={t('Purpose Statement')}
        maxLength='500'
        onChange={updateSetting('purpose')}
        type='textarea'
        value={purpose}
      />
      <SettingsControl label={t('Description')} onChange={updateSetting('description')} value={description} type='textarea' id='descriptionField' />
      <SettingsControl label={t('About Video URL')} onChange={updateSetting('aboutVideoUri')} value={aboutVideoUri} />
      <SettingsControl
        label={t('Location')}
        onChange={updateSettingDirectly('location', true)}
        location={location}
        locationObject={group.locationObject}
        type='location'
      />
      <label className={styles.label}>{t('Location Privacy:')}</label>
      <Dropdown
        className={styles.locationObfuscationDropdown}
        toggleChildren={(
          <span className={styles.locationObfuscationDropdownLabel}>
            {LOCATION_PRECISION[locationDisplayPrecision || 'precise']}
            <Icon name='ArrowDown' />
          </span>
        )}
        items={Object.keys(LOCATION_PRECISION).map(value => ({
          label: t(LOCATION_PRECISION[value]),
          onClick: () => updateSettingDirectly('settings.locationDisplayPrecision')(value)
        }))}
      />
      <p className={general.detailText}>{t('Note: with Administration rights you will always see the exact location displayed')}</p>
      <br />

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

      <br />

      <SettingsSection>
        <h3>{t('Relevant skills & interests')}</h3>
        <p className={general.detailText}>{t('What skills and interests are particularly relevant to this group?')}</p>
        <div className={cn(styles.skillsSetting, { [general.on]: showSuggestedSkills })}>
          <div className={general.switchContainer}>
            <SwitchStyled
              checked={showSuggestedSkills}
              onChange={() => updateSettingDirectly('settings.showSuggestedSkills')(!showSuggestedSkills)}
              backgroundColor={showSuggestedSkills ? '#0DC39F' : '#8B96A4'}
            />
            <span className={general.toggleDescription}>{t('Ask new members whether they have these skills and interests?')}</span>
            <div className={general.onOff}>
              <div className={general.off}>{t('OFF')}</div>
              <div className={general.on}>{t('ON')}</div>
            </div>
          </div>
        </div>
        <SkillsSection
          group={group}
          label={t('Add a relevant skill or interest')}
          placeholder={t('What skills and interests are most relevant to your group?')}
        />
      </SettingsSection>

      <br />

      <SettingsControl
        label={t('What area does your group cover?')}
        onChange={updateSetting('geoShape')}
        placeholder={t('For place based groups, draw the area where your group is active (or paste in GeoJSON here)')}
        type='text'
        value={geoShape || ''}
      />
      <div className={styles.editableMapContainer}>
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
      <Button label='Transition to new menu' onClick={transitionGroupToNewMenu} />
      <br />

      <div className={general.saveChanges}>
        <span className={saveButtonContent().style}>{saveButtonContent().text}</span>
        <Button label={t('Save Changes')} color={saveButtonContent().color} onClick={changed && !error ? save : null} className={cn('saveButton', general.saveButton)} />
      </div>
    </div>
  )
}

GroupSettingsTab.propTypes = {
  currentUser: object,
  group: object,
  fetchLocation: func,
  fetchPending: object,
  updateGroupSettings: func,
  transitionGroupToNewMenu: func,
  t: func
}

export default withTranslation()(GroupSettingsTab)
