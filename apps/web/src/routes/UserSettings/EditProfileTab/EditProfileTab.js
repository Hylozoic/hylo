import React, { useState, useEffect } from 'react'
import { withTranslation } from 'react-i18next'
import { get } from 'lodash/fp'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'
import SettingsControl from 'components/SettingsControl'
import SkillsSection from 'components/SkillsSection'
import SkillsToLearnSection from 'components/SkillsToLearnSection'
import Button from 'components/ui/button'
import Icon from 'components/Icon'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { DEFAULT_BANNER } from 'store/models/Me'
import classes from './EditProfileTab.module.scss'
import { ensureLocationIdIfCoordinate } from 'components/LocationInput/LocationInput.store'
import SocialControl from './SocialControl'
import { bgImageStyle, cn } from 'util/index'

export const validateName = name => name && name.match(/\S/gm)

function EditProfileTab ({
  currentUser,
  updateUserSettings,
  fetchPending,
  fetchLocation,
  unlinkAccount,
  setConfirm,
  t
}) {
  const [edits, setEdits] = useState({})
  const [changed, setChanged] = useState(false)

  useEffect(() => {
    setEditState()
  }, [])

  useEffect(() => {
    if (fetchPending === false) {
      setEditState()
    }
  }, [fetchPending])

  const setEditState = () => {
    if (!currentUser) return

    const {
      name, avatarUrl, bannerUrl, tagline, bio,
      contactEmail, contactPhone, locationObject, location,
      url, facebookUrl, twitterName, linkedinUrl
    } = currentUser

    setEdits({
      name: name || '',
      avatarUrl: avatarUrl || '',
      bannerUrl: bannerUrl || DEFAULT_BANNER,
      tagline: tagline || '',
      bio: bio || '',
      contactPhone: contactPhone || '',
      contactEmail: contactEmail || '',
      location: location || '',
      locationId: get('id', locationObject) || null,
      url: url || '',
      facebookUrl,
      twitterName,
      linkedinUrl
    })
  }

  const updateSetting = (key, shouldSetChanged = true) => async event => {
    const newEdits = { ...edits }
    shouldSetChanged && setConfirm(t('You have unsaved changes, are you sure you want to leave?'))

    if (key === 'location') {
      newEdits.location = event.target.value.fullText
      newEdits.locationId = await ensureLocationIdIfCoordinate({
        fetchLocation,
        location: newEdits.location,
        locationId: event.target.value.id
      })
    } else {
      newEdits[key] = event.target.value
    }

    setEdits(newEdits)
    if (shouldSetChanged) {
      setChanged(true)
    }
  }

  const updateSettingDirectly = (key, shouldSetChanged = true) => value =>
    updateSetting(key, shouldSetChanged)({ target: { value } })

  const save = () => {
    setChanged(false)
    setConfirm(false)
    updateUserSettings(edits)
  }

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Edit Your Profile'),
      icon: '',
      info: '',
      search: false
    })
  }, [])

  if (fetchPending || !currentUser) return <Loading />

  const {
    name, avatarUrl, bannerUrl, tagline, bio,
    contactEmail, contactPhone, location, url,
    facebookUrl, twitterName, linkedinUrl
  } = edits

  const locationObject = currentUser.locationObject

  return (
    <div>
      <Helmet>
        <title>{t('Edit Your Profile')} | Hylo</title>
      </Helmet>
      <label className={classes.label}>{t('Banner and Avatar Images')}</label>
      <UploadAttachmentButton
        type='userBanner'
        id={currentUser.id}
        onSuccess={({ url }) => updateSettingDirectly('bannerUrl')(url)}
        className={classes.changeBanner}
      >
        <div style={bgImageStyle(bannerUrl)} className={classes.bannerImage}><Icon name='AddImage' className={classes.uploadIcon} /></div>
      </UploadAttachmentButton>
      <UploadAttachmentButton
        type='userAvatar'
        id={currentUser.id}
        onSuccess={({ url }) => updateSettingDirectly('avatarUrl')(url)}
        className={classes.changeAvatar}
      >
        <div style={bgImageStyle(avatarUrl)} className={classes.avatarImage}><Icon name='AddImage' className={classes.uploadIcon} /></div>
      </UploadAttachmentButton>
      <SettingsControl id='nameField' label={t('Name')} onChange={updateSetting('name')} value={name || ''} maxLength={60} />
      {!validateName(name) && <div className={classes.nameValidation}>{t('Name must not be blank')}</div>}
      <SettingsControl id='taglineField' label={t('Tagline')} onChange={updateSetting('tagline')} value={tagline} maxLength={60} />
      <SettingsControl id='bioField' label={t('About Me')} onChange={updateSetting('bio')} value={bio} type='textarea' />
      <SettingsControl
        id='locationField'
        label={t('Location')}
        onChange={updateSettingDirectly('location', true)}
        location={location}
        locationObject={locationObject}
        type='location'
      />
      <SettingsControl id='urlField' label={t('Website')} onChange={updateSetting('url')} value={url} />
      <SettingsControl
        label={t('My Skills & Interests')} renderControl={() =>
          <SkillsSection personId={currentUser.id} />}
      />
      <SettingsControl
        label={t('What I\'m learning')} renderControl={() =>
          <SkillsToLearnSection personId={currentUser.id} />}
      />
      <SettingsControl id='contactEmailField' label={t('Contact Email')} onChange={updateSetting('contactEmail')} value={contactEmail} />
      <SettingsControl id='contactPhoneField' label={t('Contact Phone')} onChange={updateSetting('contactPhone')} value={contactPhone} />
      <label className={classes.socialLabel}>{t('Social Accounts')}</label>
      <SocialControl
        label='Facebook'
        provider='facebook'
        value={facebookUrl}
        updateSettingDirectly={() => updateSettingDirectly('facebookUrl')}
        handleUnlinkAccount={() => unlinkAccount('facebook')}
      />
      <SocialControl
        label='Twitter'
        provider='twitter'
        value={twitterName}
        updateSettingDirectly={() => updateSettingDirectly('twitterName')}
        handleUnlinkAccount={() => unlinkAccount('twitter')}
      />
      <SocialControl
        label='LinkedIn'
        provider='linkedin'
        value={linkedinUrl}
        updateSettingDirectly={() => updateSettingDirectly('linkedinUrl')}
        handleUnlinkAccount={() => unlinkAccount('linkedin')}
      />
      <div style={{ height: '80px' }} />
      <div className={classes.saveChanges}>
        <span className={cn({ [classes.settingChanged]: changed })}>{changed ? t('Changes not saved') : t('Current settings up to date')}</span>
        <Button
          variant={changed && validateName(name) ? 'secondary' : 'primary'}
          onClick={changed && validateName(name) ? save : null}
          className={classes.saveButton}
        >
          {t('Save Changes')}
        </Button>
      </div>
    </div>
  )
}

EditProfileTab.propTypes = {
  currentUser: PropTypes.object,
  updateUserSettings: PropTypes.func,
  fetchPending: PropTypes.bool,
  fetchLocation: PropTypes.func,
  unlinkAccount: PropTypes.func,
  setConfirm: PropTypes.func,
  t: PropTypes.func
}

export default withTranslation()(EditProfileTab)
