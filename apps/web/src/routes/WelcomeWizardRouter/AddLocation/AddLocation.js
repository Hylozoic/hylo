import { AnalyticsEvents } from '@hylo/shared'
import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import LocationInput from 'components/LocationInput'
import { ensureLocationIdIfCoordinate, fetchLocation as fetchLocationAction } from 'components/LocationInput/LocationInput.store'
import WelcomeWizardModalFooter from '../WelcomeWizardModalFooter'
import Icon from 'components/Icon'
import getMe from 'store/selectors/getMe'
import getReturnToPath from 'store/selectors/getReturnToPath'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import updateUserSettings from 'store/actions/updateUserSettings'

function AddLocation () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const returnToPath = useSelector(getReturnToPath)

  const [locationId, setLocationId] = useState(null)
  const [location, setLocation] = useState('')

  const fetchLocation = useCallback((loc) => dispatch(fetchLocationAction(loc)), [dispatch])

  useEffect(() => {
    if (currentUser && currentUser.location) {
      setLocationId(currentUser.locationObject ? currentUser.locationObject.id : null)
      setLocation(currentUser.location)
    }
  }, [currentUser])

  const handleLocationChange = (loc) => {
    setLocationId(loc.id)
    setLocation(loc.fullText)
  }

  const goToNextStep = useCallback(() => {
    if (!returnToPath) {
      dispatch(push('/welcome/explore'))
    }
  }, [dispatch, returnToPath])

  const submit = async () => {
    const coordLocationId = await ensureLocationIdIfCoordinate({ fetchLocation, location, locationId })
    const changes = Object.assign({ location, locationId: coordLocationId }, { settings: { signupInProgress: false } })

    dispatch(updateUserSettings(changes))
      .then(() => {
        dispatch(trackAnalyticsEvent(AnalyticsEvents.SIGNUP_COMPLETE))
        goToNextStep()
      })
  }

  const previous = () => {
    dispatch(push('/welcome/upload-photo'))
  }

  return (
    <div className='bg-background w-[360px] mx-auto rounded-lg'>
      <div className='p-8 relative'>
        <span className='absolute top-4 right-4 text-xs text-muted-foreground'>{t('STEP 2/3')}</span>
        <br />
        <div className='flex justify-center items-center'>
          <Icon name='Globe' className='text-[100px] mb-5 text-muted-foreground' />
        </div>
        <div className='flex justify-center items-center relative'>
          <LocationInput
            saveLocationToDB
            inputClass='w-full text-lg font-light text-muted-foreground bg-background border-b border-foreground/20 px-4 py-2 focus:outline-none'
            location={location}
            locationObject={currentUser ? currentUser.locationObject : null}
            onChange={handleLocationChange}
            placeholder={t('Where do you call home?')}
            onKeyPress={event => {
              if (event.key === 'Enter') {
                submit()
              }
            }}
            autofocus
          />
        </div>
        <div className='text-center mt-6'>
          <p className='text-muted-foreground text-sm'>
            {t('Add your location to see more relevant content, and find people and projects around you')}.
          </p>
        </div>
        <div>
          <WelcomeWizardModalFooter submit={submit} previous={previous} continueText={t('Next: Welcome to Hylo!')} />
        </div>
      </div>
    </div>
  )
}

export default AddLocation
