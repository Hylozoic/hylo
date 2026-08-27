import { get } from 'lodash/fp'
import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push, goBack } from 'redux-first-history'
import { ImageUp, Loader2 } from 'lucide-react'
import { bgImageStyle } from 'util/index'
import Loading from 'components/Loading'
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
    <div className='bg-card shadow-md w-[360px] mx-auto rounded-lg'>
      <div className='p-8 relative flex flex-col min-h-[480px]'>
        <span className='absolute top-4 right-4 text-xs text-muted-foreground'>{t('STEP 1/3')}</span>
        <div className='flex-1 flex flex-col justify-center'>
          <div className='flex justify-center items-center'>
          <div className='border-3 border-dashed border-primary/50 w-40 h-40 rounded-full p-2'>
            <UploadAttachmentButton
              type='userAvatar'
              id={currentUser.id}
              onSuccess={({ url }) => updateSettingDirectly('avatarUrl')(url)}
            >
              <div className='relative w-[140px] h-[140px]'>
                <div
                  className='w-full h-full rounded-full bg-center bg-cover cursor-pointer'
                  style={bgImageStyle(currentAvatarUrl)}
                />
                <span
                  data-testid='upload-photo-button'
                  className='absolute bottom-1 right-1 flex items-center justify-center w-9 h-9 rounded-full bg-selected/50 text-foreground shadow-md border-2 border-card cursor-pointer'
                >
                  {uploadImagePending
                    ? <Loader2 className='w-5 h-5 animate-spin' />
                    : <ImageUp className='w-5 h-5' />}
                </span>
              </div>
            </UploadAttachmentButton>
          </div>
        </div>
          <div className='text-center mt-6'>
            <h3 className='text-xl font-bold text-foreground mb-2'>{t('Upload a profile image')}</h3>
            <p className='text-muted-foreground text-sm'>{t('Almost done setting up your profile! Click the above profile icon to upload a custom profile image. Your profile image will be visible when you post or comment in groups.')}</p>
          </div>
        </div>
        <div className='mt-auto'>
          <WelcomeWizardModalFooter previous={previous} submit={submit} showPrevious={false} continueText={t('Next: Where are you from?')} continueReady={!!edits.avatarUrl && !uploadImagePending} />
        </div>
      </div>
    </div>
  )
}

export default UploadPhoto
