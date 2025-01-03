import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { get } from 'lodash/fp'
import { bgImageStyle } from 'util/index'
import Loading from 'components/Loading'
import Icon from 'components/Icon'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import WelcomeWizardModalFooter from '../WelcomeWizardModalFooter'
import classes from '../WelcomeWizard.module.scss'

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
      <div className={classes.flexWrapper}>
        <div className={classes.panel}>
          <span className={classes.stepCount}>{t('STEP 1/3')}</span>
          <br />
          <div className={classes.center}>
            <div className={classes.uploadWrapper}>
              <UploadAttachmentButton
                type='userAvatar'
                id={currentUser.id}
                onSuccess={({ url }) => this.updateSettingDirectly('avatarUrl')(url)}
              >
                <div className={classes.avatar} style={bgImageStyle(currentAvatarUrl)}>
                  <Icon className={classes.uploadIcon} name={uploadImagePending ? 'Clock' : 'AddImage'} dataTestId='icon-AddImage' />
                </div>
              </UploadAttachmentButton>
            </div>
          </div>
          <div className={classes.instructions}>
            <h3>{t('Upload a profile image')}</h3>
            <p>{t('Almost done setting up your profile! Click the above profile icon to upload a custom profile image. Your profile image will be visible when you post or comment in groups.')}</p>
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
