import React, { useState, useEffect } from 'react'
import { withTranslation } from 'react-i18next'
import { get } from 'lodash/fp'
import PropTypes from 'prop-types'
import { ImageUp } from 'lucide-react'
import { Helmet } from 'react-helmet'
import SettingsControl from 'components/SettingsControl'
import SkillsSection from 'components/SkillsSection'
import SkillsToLearnSection from 'components/SkillsToLearnSection'
import Button from 'components/ui/button'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { DEFAULT_BANNER } from 'store/models/Me'
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
    <div className='max-w-3xl mx-auto px-4 py-6'>
      <Helmet>
        <title>{t('Edit Your Profile')} | Hylo</title>
      </Helmet>

      <div className='space-y-6'>
        <div>
          <label className='text-sm text-foreground/50 block mb-2'>{t('Banner and Avatar Images')}</label>
          <div className='relative'>
            <UploadAttachmentButton
              type='userBanner'
              id={currentUser.id}
              onSuccess={({ url }) => updateSettingDirectly('bannerUrl')(url)}
              className='w-full group'
            >
              <div
                style={bgImageStyle(bannerUrl)}
                className='relative w-full h-[20vh] flex flex-col items-center justify-center rounded-lg shadow-md bg-cover bg-center bg-darkening/20 hover:bg-darkening/100 scale-100 hover:scale-105 transition-all cursor-pointer'
              >
                <div className='absolute top-0 left-0 w-full h-full bg-darkening/20 group-hover:bg-darkening/60 transition-all duration-300 z-0 rounded-lg' />
                <ImageUp className='w-8 h-8 text-white/60 group-hover:text-white/100 transition-colors relative z-1' />
              </div>
            </UploadAttachmentButton>

            <UploadAttachmentButton
              type='userAvatar'
              id={currentUser.id}
              onSuccess={({ url }) => updateSettingDirectly('avatarUrl')(url)}
              className='absolute -bottom-10 left-1/2 -translate-x-1/2 bg-midground group'
            >
              <div
                style={bgImageStyle(avatarUrl)}
                className='relative w-20 h-20 rounded-lg shadow-md flex items-center justify-center group bg-cover scale-100 hover:scale-105 transition-all cursor-pointer'
              >
                <div className='absolute top-0 left-0 w-full h-full bg-darkening/20 group-hover:bg-darkening/60 transition-all duration-300 z-0 rounded-lg' />
                <ImageUp className='w-6 h-6 text-foreground/50 group-hover:text-foreground/80 transition-colors relative z-1' />
              </div>
            </UploadAttachmentButton>
          </div>
        </div>

        <div className='space-y-4 mt-12'>
          <SettingsControl
            id='nameField'
            label={t('Name')}
            onChange={updateSetting('name')}
            value={name || ''}
            maxLength={60}
          />
          {!validateName(name) && (
            <div className='text-destructive text-sm'>{t('Name must not be blank')}</div>
          )}
          <SettingsControl
            id='taglineField'
            label={t('Tagline')}
            onChange={updateSetting('tagline')}
            value={tagline}
            maxLength={60}
          />
          <SettingsControl
            id='bioField'
            label={t('About Me')}
            onChange={updateSetting('bio')}
            value={bio}
            type='textarea'
          />
          <SettingsControl
            id='locationField'
            label={t('Location')}
            onChange={updateSettingDirectly('location', true)}
            location={location}
            locationObject={locationObject}
            type='location'
          />
          <SettingsControl
            id='urlField'
            label={t('Website')}
            onChange={updateSetting('url')}
            value={url}
          />

          <div className='border-t border-foreground/10 pt-6'>
            <SettingsControl
              label={t('My Skills & Interests')}
              renderControl={() => <SkillsSection personId={currentUser.id} />}
            />
          </div>

          <div className='border-t border-foreground/10 pt-6'>
            <SettingsControl
              label={t("What I'm learning")}
              renderControl={() => <SkillsToLearnSection personId={currentUser.id} />}
            />
          </div>

          <div className='border-t border-foreground/10 pt-6'>
            <SettingsControl
              id='contactEmailField'
              label={t('Contact Email')}
              onChange={updateSetting('contactEmail')}
              value={contactEmail}
            />

            <SettingsControl
              id='contactPhoneField'
              label={t('Contact Phone')}
              onChange={updateSetting('contactPhone')}
              value={contactPhone}
            />
          </div>

          <div className='border-t border-foreground/10 pt-6'>
            <label className='text-sm font-medium text-foreground/50 mb-4 block'>{t('Social Accounts')}</label>
            <div className='space-y-4'>
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
            </div>
          </div>
        </div>
      </div>

      <div className='sticky bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-foreground/10 p-4 rounded-lg shadow-xl mt-4'>
        <div className='max-w-3xl mx-auto flex items-center justify-between'>
          <span className={cn('text-sm transition-colors', changed ? 'text-accent' : 'text-foreground/50')}>
            {changed ? t('Changes not saved') : t('Current settings up to date')}
          </span>
          <Button
            variant={changed && validateName(name) ? 'highVisibility' : 'outline'}
            onClick={changed && validateName(name) ? save : null}
            disabled={!changed || !validateName(name)}
          >
            {t('Save Changes')}
          </Button>
        </div>
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
