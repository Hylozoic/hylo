import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useState } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { AnalyticsEvents } from '@hylo/shared'
import Icon from 'components/Icon'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import {
  createMemberInviteLink,
  fetchMyInviteLink,
  resetMemberInviteLink
} from './InviteSettingsTab.store'

const inviteLinkFrom = result => result?.payload?.data
const cardClasses = 'border-2 mt-2 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'
const buttonClasses = 'flex items-center justify-center text-nowrap shrink-0 gap-2 bg-card border-2 border-accent/20 text-accent rounded-lg p-3 hover:border-foreground/50 transition-all hover:cursor-pointer text-sm w-full sm:w-auto'

/**
 * The personal invite link of someone with limited invite access: made when they ask for it,
 * with Copy and Reset. Everyone who joins or asks to join through it counts toward their
 * invites for the day, and stewards see who invited the people who ask to join.
 */
export default function MemberInviteLinkCard ({ group, needsApproval }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [path, setPath] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [working, setWorking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    dispatch(fetchMyInviteLink(group.id))
      .then(result => {
        if (!current) return
        setPath(inviteLinkFrom(result)?.group?.myInviteLink?.path || null)
        setLoaded(true)
      })
      .catch(() => current && setLoaded(true))
    return () => { current = false }
  }, [dispatch, group.id])

  const run = useCallback(async (action, field) => {
    setWorking(true)
    setError('')
    try {
      const result = await dispatch(action(group.id))
      setPath(inviteLinkFrom(result)?.[field]?.path || null)
    } catch {
      setError(t('Something went wrong. Please try again.'))
    } finally {
      setWorking(false)
    }
  }, [dispatch, group.id, t])

  const onCreate = () => run(createMemberInviteLink, 'createMemberInviteLink')

  const onReset = () => {
    if (window.confirm(t("Are you sure you want to reset your invite link? The current link won't work anymore."))) {
      run(resetMemberInviteLink, 'resetMemberInviteLink')
    }
  }

  const onCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
    dispatch(trackAnalyticsEvent(AnalyticsEvents.INVITE_LINK_COPIED, { groupId: group.id, kind: 'member' }))
  }

  if (!loaded) return null

  const url = path ? `${window.location.origin}${path}` : ''

  return (
    <div className={cardClasses} data-testid='member-invite-link-card'>
      <div className='text-foreground'>
        <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>{t('Your personal invite link')}</h2>
        <div className='text-sm'>
          <strong>
            {needsApproval
              ? t('People who use your link ask to join, and a steward reviews their request.')
              : t('People who use your link join right away.')}
          </strong>{' '}
          <span className='text-foreground-muted'>{t('Everyone who uses it counts toward your invites for the day.')}</span>
        </div>
      </div>
      {path
        ? (
          <div className='flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 w-full'>
            <div className='min-w-0 w-full sm:flex-1 overflow-hidden'>
              <CopyToClipboard text={url} onCopy={onCopy}>
                <button type='button' className='flex relative items-center group gap-2 min-w-0 w-full max-w-full bg-card border-2 border-foreground/20 rounded-lg p-2 hover:border-foreground/50 transition-all hover:cursor-pointer'>
                  <span className='min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-left' dir='rtl'>
                    <bdi className='text-selected'>{url}</bdi>
                  </span>
                  <span className='flex items-center gap-2 bg-foreground/10 rounded-lg p-1 group-hover:bg-selected/50 transition-all shrink-0'>
                    {copied
                      ? <>{t('Copied!')}</>
                      : <><Icon name='Copy' /> {t('Copy')}</>}
                  </span>
                </button>
              </CopyToClipboard>
            </div>
            <button type='button' onClick={onReset} disabled={working} className={buttonClasses}>
              {t('Reset Link')}
            </button>
          </div>
          )
        : (
          <button type='button' onClick={onCreate} disabled={working} className={buttonClasses}>
            {t('Create my invite link')}
          </button>
          )}
      {error && <p className='text-sm text-accent m-0'>{error}</p>}
    </div>
  )
}

MemberInviteLinkCard.propTypes = {
  group: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired }).isRequired,
  needsApproval: PropTypes.bool
}
