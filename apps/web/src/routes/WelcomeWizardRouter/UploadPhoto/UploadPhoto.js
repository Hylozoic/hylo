import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { get } from 'lodash/fp'
import { bgImageStyle } from 'util/index'
import Loading from 'components/Loading'
import Icon from 'components/Icon'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import WelcomeWizardModalFooter from '../WelcomeWizardModalFooter'

class UploadPhoto extends Component {
  constructor () {
    super()
    this.state = {
      edits: {}
    }
  }

  submit = () => {
    this.setState({ changed: false })
    this.props.updateUserSettings(this.state.edits)
    this.props.goToNextStep()
  }

  updateSettingDirectly = (key, setChanged) => value => {
    const { edits, changed } = this.state
    this.setState({
      changed: setChanged ? true : changed,
      edits: {
        ...edits,
        [key]: value
      }
    })
  }

  getValue = (field) => {
    return this.state.edits[field] || get(field, this.props.currentUser)
  }

  render () {
    const { currentUser, uploadImagePending, t } = this.props

    if (!currentUser) return <Loading />

    const currentAvatarUrl = this.getValue('avatarUrl')

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
                onSuccess={({ url }) => this.updateSettingDirectly('avatarUrl')(url)}
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
            <WelcomeWizardModalFooter previous={this.previous} submit={this.submit} showPrevious={false} continueText={t('Next: Where are you from?')} />
          </div>
        </div>
      </div>
    )
  }
}

export default withTranslation()(UploadPhoto)
