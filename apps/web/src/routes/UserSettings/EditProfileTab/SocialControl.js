import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { Facebook, Twitter, Linkedin, Check, Link as LinkIcon, Unlink, Link2Off } from 'lucide-react'
import Button from 'components/ui/button'

const { func, string } = PropTypes

class SocialControl extends Component {
  static propTypes = {
    label: string,
    provider: string,
    value: string,
    updateSettingDirectly: func,
    handleUnlinkAccount: func
  }

  windowPrompt (network, urlPattern) {
    const promptText = this.props.t('Please enter the full url for your {{network}} page.', { network })
    const invalidUrlText = this.props.t('Invalid url. Please enter the full url for your {{network}} page.', { network })

    let url = window.prompt(promptText)

    if (url) {
      while (!url && !url.match(urlPattern)) {
        url = window.prompt(invalidUrlText)
      }
    }
    return url
  }

  handleLinkClick () {
    const { provider, updateSettingDirectly } = this.props

    switch (provider) {
      case 'twitter': {
        const twitterHandle = window.prompt(this.props.t('Please enter your twitter name.'))
        if (twitterHandle) {
          updateSettingDirectly()(twitterHandle)
        }
        break
      }
      case 'linkedin': {
        const network = 'LinkedIn'
        const urlPattern = /^(http(s)?:\/\/)?([\w]+\.)?linkedin\.com/
        const url = this.windowPrompt(network, urlPattern)
        if (url) {
          updateSettingDirectly()(url)
        }
        break
      }
      case 'facebook': {
        const network = 'Facebook'
        const urlPattern = /^(http(s)?:\/\/)?([\w]+\.)?facebook\.com/
        const url = this.windowPrompt(network, urlPattern)
        if (url) {
          updateSettingDirectly()(url)
        }
        break
      }
    }
  }

  handleUnlinkClick () {
    const { handleUnlinkAccount, updateSettingDirectly } = this.props

    handleUnlinkAccount()
    updateSettingDirectly()(null)
  }

  getSocialIcon () {
    const { provider } = this.props
    const iconProps = {
      className: 'w-5 h-5'
    }

    switch (provider) {
      case 'facebook':
        return <Facebook {...iconProps} />
      case 'twitter':
        return <Twitter {...iconProps} />
      case 'linkedin':
        return <Linkedin {...iconProps} />
      default:
        return null
    }
  }

  render () {
    const { label, value = '', t } = this.props
    const linked = !!value

    return (
      <div className='relative group bg-background/50 hover:bg-background border border-foreground/10 hover:border-foreground/20 rounded-lg p-4 transition-all duration-300'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            {this.getSocialIcon()}
            <div className='flex flex-col'>
              <span className='text-sm font-medium text-foreground'>{label}</span>
              {linked && (
                <span className='text-xs text-foreground/50 truncate max-w-[200px]'>{value}</span>
              )}
            </div>
            {linked && (
              <div className='flex items-center ml-2 text-selected text-sm bg-selected/10 rounded-lg p-2'>
                <Check className='w-4 h-4 text-selected' /> {t('Linked')}
              </div>
            )}
            {!linked && (
              <div className='flex items-center ml-2 text-foreground/50 gap-1 text-sm p-2 bg-black/20 rounded-lg'>
                <Link2Off className='w-4 h-4' /> {t('Not Linked')}
              </div>
            )}
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={linked ? () => this.handleUnlinkClick() : () => this.handleLinkClick()}
            className='opacity-0 group-hover:opacity-100 transition-opacity'
          >
            {linked
              ? (
                <div className='flex items-center gap-2'>
                  <Unlink className='w-4 h-4' />
                  <span>{t('Unlink')}</span>
                </div>
                )
              : (
                <div className='flex items-center gap-2'>
                  <LinkIcon className='w-4 h-4' />
                  <span>{t('Link')}</span>
                </div>
                )}
          </Button>
        </div>
      </div>
    )
  }
}

export default withTranslation()(SocialControl)
