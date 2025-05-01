import isMobile from 'ismobilejs'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import TextareaAutosize from 'react-textarea-autosize'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Tooltip } from 'react-tooltip'
import { TextHelpers } from '@hylo/shared'
import { isEmpty } from 'lodash'
import { TransitionGroup, CSSTransition } from 'react-transition-group'
import Button from 'components/Button'
import Loading from 'components/Loading'
import Icon from 'components/Icon'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { cn } from 'util/index'
import { GROUP_VISIBILITY } from 'store/models/Group'

import classes from './InviteSettingsTab.module.scss'

const { object, func, string } = PropTypes

const parseEmailList = emails =>
  (emails || '').split(/,|\n/).map(email => {
    const trimmed = email.trim()
    const match = trimmed.match(/.*<(.*)>/)
    return match ? match[1] : trimmed
  })

function InviteSettingsTab (props) {
  const {
    group,
    regenerateAccessCode,
    inviteLink,
    createInvitations,
    trackAnalyticsEvent,
    pendingCreate,
    pending,
    pendingInvites = [],
    expireInvitation,
    resendInvitation,
    reinviteAll
  } = props

  const { t } = useTranslation()

  const defaultMessage = t(`Hi!

I'm inviting you to join {{name}} on Hylo.

{{name}} is using Hylo for our online community: this is our dedicated space for communication & collaboration.`, { name: group.name })

  const [copied, setCopied] = useState(false)
  const [reset, setReset] = useState(false)
  const [emails, setEmails] = useState('')
  const [message, setMessage] = useState(defaultMessage)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const sendingRef = useRef(false)
  const pendingInvitesTransitionRef = useRef(null)

  const setTemporaryState = (setter, value) => {
    setter(value)
    setTimeout(() => {
      setter(false)
    }, 3000)
  }

  const handleSendInvites = () => {
    if (sendingRef.current) return
    sendingRef.current = true

    createInvitations(parseEmailList(emails), message)
      .then(res => {
        sendingRef.current = false
        const { invitations } = res.payload.data.createInvitation
        const badEmails = invitations.filter(email => email.error).map(e => e.email)

        const numBad = badEmails.length
        let errorMessage, successMessage
        if (numBad > 0) {
          errorMessage = `${t('{{numBad}} invalid email address/es found (see above)).', { numBad })}{' '}`
        }
        const numGood = invitations.length - badEmails.length
        if (numGood > 0) {
          successMessage = t('Sent {{numGood}} {{email}}', { numGood, email: numGood === 1 ? 'email' : 'emails' })
          trackAnalyticsEvent('Group Invitations Sent', { numGood })
        }
        setEmails(badEmails.join('\n'))
        setErrorMessage(errorMessage)
        setSuccessMessage(successMessage)
      })
  }

  const onReset = () => {
    if (window.confirm(t("Are you sure you want to create a new join link? The current link won't work anymore if you do."))) {
      regenerateAccessCode()
      setTemporaryState(setReset, true)
    }
  }

  const onCopy = () => setTemporaryState(setCopied, true)

  const buttonColor = highlight => highlight ? 'green' : 'green-white-green-border'

  const disableSendBtn = (isEmpty(emails) || pendingCreate)

  const resendAllOnClick = useCallback(() => {
    if (window.confirm(t('Are you sure you want to resend all Pending Invitations'))) {
      reinviteAll()
    }
  }, [reinviteAll])

  const expireOnClick = useCallback((invitationToken) => {
    expireInvitation(invitationToken)
  }, [expireInvitation])

  const resendOnClick = useCallback((invitationToken) => {
    resendInvitation(invitationToken)
  }, [resendInvitation])

  const hasPendingInvites = !isEmpty(pendingInvites)

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Invite People'),
      icon: 'People',
      info: ''
    })
  }, [])

  return (
    <div className={classes.container}>
      <div className='text-foreground text-center'>{t('Grow your group')}</div>

      {pending && <Loading />}

      {!pending && (
        <>
          {group.visibility === GROUP_VISIBILITY.Public && (
            <div className='border-2 mt-6 p-4 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-2 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
              <div className='text-foreground'>
                <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>{t('Public Group Link')}</h2>
                <div className='text-sm'><strong>{t('Use this for people you don\'t know')}</strong> <span className='text-foreground/50'>{t('who you would like ask join questions to vet before they enter the group.')}</span></div>
              </div>
              <div>
                <CopyToClipboard text={`${window.location.origin}/groups/${group.slug}`} onCopy={onCopy}>
                  <button className='flex items-center group gap-2 bg-card border-2 border-foreground/20 rounded-lg p-2 hover:border-foreground/100 transition-all hover:cursor-pointer' data-tooltip-content={t('Click to Copy')} data-tooltip-id='public-link-tooltip'>
                    <span className='text-selected'>{`${window.location.origin}/groups/${group.slug}`}</span>
                    <div className='flex items-center gap-2 bg-foreground/10 rounded-lg p-1 group-hover:bg-selected/50 transition-all'>
                      <Icon name='Copy' /> Copy
                    </div>
                  </button>
                </CopyToClipboard>
                {!isMobile.any && (
                  <Tooltip
                    place='top'
                    type='dark'
                    id='public-link-tooltip'
                    effect='solid'
                    delayShow={500}
                  />
                )}
                {copied && <span className={classes.copiedText}>{t('Copied!')}</span>}
              </div>
            </div>
          )}

          <div className='border-2 mt-6 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
            <div className='text-foreground'>
              <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>{t('Share a Join Link')}</h2>
              <div className='text-sm'><strong>{t('Use this link to invite people you know and trust.')}</strong> <span className='text-foreground/50'>{t('They will still have the opportunity to answer any join questions and agree to agreements before they enter the group.')}</span></div>
            </div>
            <div className='flex items-center gap-2'>
              {inviteLink && (
                <div className='flex items-center gap-2'>
                  {!copied && (
                    <>
                      <CopyToClipboard text={inviteLink} onCopy={onCopy}>
                        <button className='flex relative items-center group gap-2 bg-card border-2 border-foreground/20 rounded-lg p-2 hover:border-foreground/100 transition-all hover:cursor-pointer justify-between' data-tooltip-content={t('Click to Copy')} data-tooltip-id='invite-link-tooltip'>
                          <span className='text-selected truncate w-[80%] max-w-[450px]'>{inviteLink}</span>
                          <div className='flex items-center gap-2 bg-foreground/10 rounded-lg p-1 group-hover:bg-selected/50 transition-all'>
                            <Icon name='Copy' /> Copy
                          </div>
                        </button>
                      </CopyToClipboard>
                      {!isMobile.any && (
                        <Tooltip
                          place='top'
                          type='dark'
                          id='invite-link-tooltip'
                          effect='solid'
                          delayShow={500}
                        />
                      )}
                    </>
                  )}
                  {copied && t('Copied!')}
                </div>
              )}
              <button onClick={onReset} className='flex items-center text-nowrap group gap-2 bg-card border-2 border-accent/20 text-accent rounded-lg p-3 hover:border-foreground/100 transition-all hover:cursor-pointer text-sm' color={buttonColor(reset)}>
                {inviteLink ? t('Reset Link') : t('Generate a Link')}
              </button>
            </div>
          </div>
        </>
      )}

      <div className='border-2 mt-6 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
        <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>
          {t('Send Invites via email')}
        </h2>
        <span className='text-sm text-foreground/50'>{t('An email invitation link will be sent to each email address, which allows them to bypass the group approval process. They will still be shown any required questions or agreements you may have set.')}</span>
        <p>{t('Enter email addresses separated by commas or new lines')}</p>
        <TextareaAutosize
          minRows={1}
          className='rounded-lg bg-input text-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 border-2 border-transparent focus:border-focus p-2'
          placeholder={t('example@domain.com, secondexample@domain2.us, etc@example.com')}
          value={emails}
          disabled={pendingCreate}
          onChange={(event) => setEmails(event.target.value)}
        />
        <div className='mt-4 mb-2'>{t('Customize the invite email message (optional):')}</div>
        <TextareaAutosize
          minRows={5}
          className='rounded-lg bg-input text-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 border-2 border-transparent focus:border-focus p-2'
          value={message}
          disabled={pendingCreate}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className={classes.sendInviteButton}>
          <div className={classes.sendInviteFeedback}>
            {errorMessage && <span className={classes.error}>{errorMessage}</span>}
            {successMessage && <span className={classes.success}>{successMessage}</span>}
          </div>
          <Button color='green' disabled={disableSendBtn} onClick={handleSendInvites} narrow small>
            {t('Send Invite')}
          </Button>
        </div>
      </div>

      {hasPendingInvites && (
        <div className='border-2 mt-6 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
          <div className='w-full flex justify-between items-center'>
            <h2 className='text-lg font-bold mt-0 mb-1 text-foreground w-full'>{t('Pending Invites')}</h2>
            {hasPendingInvites && (
              <button
                className='focus:text-foreground w-[120px] relative text-base border-2 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background block transition-all scale-100 hover:scale-105 hover:opacity-100 text-foreground opacity-100 border-foreground/20'
                onClick={resendAllOnClick}
              >
                {t('Resend All')}
              </button>
            )}
          </div>
          <div className={classes.pendingInvitesList}>
            <TransitionGroup>
              {pendingInvites.map((invite, index) => (
                <CSSTransition
                  classNames={{
                    enter: classes.enter,
                    enterActive: classes.enterActive,
                    exit: classes.exit,
                    exitActive: classes.exitActive
                  }}
                  timeout={{ enter: 400, exit: 500 }}
                  key={index}
                  nodeRef={pendingInvitesTransitionRef}
                >
                  <div className='w-full flex justify-between items-center bg-card rounded-lg p-2' key={invite.id} ref={pendingInvitesTransitionRef}>
                    <div style={{ flex: 1 }}>
                      <span>{invite.email}</span>
                      <span className='pl-2 text-foreground/50'>{TextHelpers.humanDate(invite.lastSentAt)}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className={cn('flex items-center gap-2 bg-foreground/10 rounded-lg p-1 group-hover:bg-selected/50 transition-all', classes.expireBtn)} onClick={() => expireOnClick(invite.id)}>{t('Expire')}</span>
                      <span className={cn('flex items-center gap-2 bg-foreground/10 rounded-lg p-1 group-hover:bg-selected/50 transition-all', classes.actionBtn, classes.resendBtn)} onClick={() => !invite.resent && resendOnClick(invite.id)}>{invite.resent ? t('Sent') : t('Resend')}</span>
                    </div>
                  </div>
                </CSSTransition>
              ))}
            </TransitionGroup>
          </div>
        </div>
      )}
    </div>
  )
}

InviteSettingsTab.propTypes = {
  group: object,
  regenerateAccessCode: func,
  inviteLink: string
}

export default InviteSettingsTab
