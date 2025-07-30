import { AnalyticsEvents } from '@hylo/shared'
import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import LocationInput from 'components/LocationInput'
import { ensureLocationIdIfCoordinate } from 'components/LocationInput/LocationInput.store'
import WelcomeWizardModalFooter from '../WelcomeWizardModalFooter'
import Icon from 'components/Icon'

class AddLocation extends Component {
  constructor () {
    super()
    this.state = {
      locationId: null,
      location: ''
    }
  }

  componentDidMount = () => {
    this.setLocation()
  }

  setLocation = () => {
    const { currentUser } = this.props
    if (currentUser && currentUser.location) {
      this.setState({
        locationId: currentUser.locationObject ? currentUser.locationObject.id : null,
        location: currentUser.location
      })
    }
  }

  handleLocationChange = (location) => {
    this.setState({
      locationId: location.id,
      location: location.fullText
    })
  }

  submit = async () => {
    const { locationId, location } = this.state
    const { fetchLocation } = this.props

    const coordLocationId = await ensureLocationIdIfCoordinate({ fetchLocation, location, locationId })
    const changes = Object.assign({ location, locationId: coordLocationId }, { settings: { signupInProgress: false } })

    this.props.updateUserSettings(changes)
      .then(() => {
        this.props.trackAnalyticsEvent(AnalyticsEvents.SIGNUP_COMPLETE)
        this.props.goToNextStep()
      })
  }

  previous = () => {
    this.props.goToPreviousStep()
  }

  render () {
    const { t } = this.props

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
              location={this.state.location}
              locationObject={this.props.currentUser ? this.props.currentUser.locationObject : null}
              onChange={this.handleLocationChange}
              placeholder={t('Where do you call home?')}
              onKeyPress={event => {
                if (event.key === 'Enter') {
                  this.submit()
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
            <WelcomeWizardModalFooter submit={this.submit} previous={this.previous} continueText={t('Next: Welcome to Hylo!')} />
          </div>
        </div>
      </div>
    )
  }
}

export default withTranslation()(AddLocation)
