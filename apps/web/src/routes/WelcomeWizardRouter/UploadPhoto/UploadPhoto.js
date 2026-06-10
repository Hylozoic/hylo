import { get } from 'lodash/fp'
import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push, goBack } from 'redux-first-history'
import { bgImageStyle } from 'util/index'
import Loading from 'components/Loading'
import Icon from 'components/Icon'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import WelcomeWizardModalFooter from '../WelcomeWizardModalFooter'
import getMe from 'store/selectors/getMe'
import updateUserSettings from 'store/actions/updateUserSettings'
import { UPLOAD_ATTACHMENT } from 'store/constants'

function UploadPhoto () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const uploadImagePending = useSelector(state => state.pending[UPLOAD_ATTACHMENT])

  const [edits, setEdits] = useState({})

  const updateSettingDirectly = useCallback((key) => value => {
    setEdits(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const getValue = useCallback((field) => {
    return edits[field] || get(field, currentUser)
  }, [edits, currentUser])

  const submit = () => {
    dispatch(updateUserSettings(edits))
    dispatch(push('/welcome/add-location'))
  }

  const previous = () => {
    dispatch(goBack())
  }

  if (!currentUser) return <Loading />

  const currentAvatarUrl = getValue('avatarUrl')

  return (
    <div className='bg-background w-[360px] mx-auto rounded-lg'>
      <div className='p-8 relative'>
        <span className='absolute top-4 right-4 text-xs text-muted-foreground'>{t('STEP 1/3')}</span>
        <br />
        <div className='flex justify-center items-center'>
          <div className='border-3 border-dashed border-primary/50 w-40 h-40 rounded-full p-2'>
            <UploadAttachmentButton
              type='userAvatar'
              id={currentUser.id}
              onSuccess={({ url }) => updateSettingDirectly('avatarUrl')(url)}
            >
              <div
                className='flex items-end justify-center w-[140px] h-[140px] rounded-full bg-center bg-cover cursor-pointer'
                style={bgImageStyle(currentAvatarUrl)}
              >
                <Icon
                  className='mx-auto cursor-pointer opacity-50 text-3xl text-white drop-shadow-md'
                  name={uploadImagePending ? 'Clock' : 'AddImage'}
                  dataTestId='icon-AddImage'
                />
              </div>
            </UploadAttachmentButton>
          </div>
        </div>
        <div className='text-center mt-6'>
          <h3 className='text-xl font-bold text-foreground mb-2'>{t('Upload a profile image')}</h3>
          <p className='text-muted-foreground text-sm'>{t('Almost done setting up your profile! Click the above profile icon to upload a custom profile image. Your profile image will be visible when you post or comment in groups.')}</p>
        </div>
        <div>
          <WelcomeWizardModalFooter previous={previous} submit={submit} showPrevious={false} continueText={t('Next: Where are you from?')} />
        </div>
      </div>
    </div>
  )
}

export default UploadPhoto
