import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { cn } from 'util/index'

export const DESCRIBE_EMAIL_UNSUBSCRIBE = 'EmailUnsubscribe/DESCRIBE_EMAIL_UNSUBSCRIBE'
export const CONFIRM_EMAIL_UNSUBSCRIBE = 'EmailUnsubscribe/CONFIRM_EMAIL_UNSUBSCRIBE'

// What the link in the email would switch off, without changing anything
export function describeEmailUnsubscribe (token) {
  return {
    type: DESCRIBE_EMAIL_UNSUBSCRIBE,
    payload: { api: { path: '/noo/email/unsubscribe/describe', method: 'GET', params: { token } } }
  }
}

export function confirmEmailUnsubscribe (token) {
  return {
    type: CONFIRM_EMAIL_UNSUBSCRIBE,
    payload: { api: { path: '/noo/email/unsubscribe', method: 'POST', params: { token } } }
  }
}

function useUnsubscribeText ({ descriptor, groupName, frequency }) {
  const { t } = useTranslation()
  const [kind] = (descriptor || '').split(':')
  switch (kind) {
    case 'group_digest':
      if (frequency) {
        return {
          question: frequency === 'weekly' ? t('Stop your weekly Hylo digest?') : t('Stop your daily Hylo digest?'),
          detail: t('This stops the digest for every group it covers. Everything is still waiting for you in Hylo.')
        }
      }
      return {
        question: groupName ? t('Stop the email digest from {{groupName}}?', { groupName }) : t('Stop these emails?'),
        detail: t('Its hourly chat digests stop too. Everything is still waiting for you in Hylo.')
      }
    case 'group_post_email':
      return {
        question: groupName ? t('Stop emails from {{groupName}}?', { groupName }) : t('Stop these emails?'),
        detail: t("All email from this group stops, including its digest and mentions. Mobile notifications don't change.")
      }
    case 'comment_email':
      return {
        question: t('Stop emails about comments on posts you follow?'),
        detail: t('Comments that mention you still notify you, by email and push where your group settings allow.')
      }
    case 'dm_email':
      return {
        question: t('Stop emails about direct messages?'),
        detail: t("Mobile notifications for direct messages don't change.")
      }
    case 'membership_setting':
      return {
        question: groupName ? t('Stop these emails from {{groupName}}?', { groupName }) : t('Stop these emails?'),
        detail: null
      }
    default:
      return null
  }
}

/**
 * The page an email's unsubscribe link opens (D34). It only asks: nothing changes until
 * the Unsubscribe button is pressed, so link scanners that open it unsubscribe no one.
 */
export default function EmailUnsubscribe ({ className }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const token = new URLSearchParams(location.search).get('token')
  // loading, ready, submitting, done, invalid, error
  const [status, setStatus] = useState('loading')
  const [submitFailed, setSubmitFailed] = useState(false)
  const [info, setInfo] = useState({})
  const text = useUnsubscribeText(info)

  const isInvalid = err => err?.response?.status === 400

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    Promise.resolve(dispatch(describeEmailUnsubscribe(token)))
      .then(result => {
        const payload = result?.payload
        if (result?.error || !payload?.descriptor) throw payload
        setInfo(payload)
        setStatus(payload.done ? 'done' : 'ready')
      })
      .catch(err => setStatus(isInvalid(err) ? 'invalid' : 'error'))
  }, [token])

  const unsubscribe = () => {
    setStatus('submitting')
    setSubmitFailed(false)
    Promise.resolve(dispatch(confirmEmailUnsubscribe(token)))
      .then(result => {
        if (result?.error || !result?.payload?.success) throw result?.payload
        setStatus('done')
      })
      .catch(err => {
        if (isInvalid(err)) return setStatus('invalid')
        setStatus('ready')
        setSubmitFailed(true)
      })
  }

  const settingsLink = (
    <Link to='/my/notifications' className='text-selected underline' data-testid='notification-settings-link'>
      {t('Notification Settings')}
    </Link>
  )

  const settingsPageOnly = (status === 'ready' || status === 'submitting') && !text

  return (
    <>
      <Helmet>
        <title>{t('Unsubscribe')} | Hylo</title>
        <meta name='robots' content='noindex' />
      </Helmet>
      <div className={className}>
        <div className='bg-midground rounded-md p-4 w-full max-w-[360px] mx-auto text-foreground' data-testid='email-unsubscribe'>
          {status === 'loading' && <p className='text-center m-0'>{t('Loading...')}</p>}

          {(status === 'ready' || status === 'submitting') && text && (
            <>
              <h1 className='text-xl font-bold mb-3 text-center'>{text.question}</h1>
              {text.detail && <p className='mb-4 text-foreground/80 text-center'>{text.detail}</p>}
              <Button
                className={cn('w-full mt-2 rounded-md p-2 bg-selected')}
                onClick={unsubscribe}
                disabled={status === 'submitting'}
                data-testid='confirm-unsubscribe'
              >
                {t('Unsubscribe')}
              </Button>
              {submitFailed && <p className='mt-3 mb-0 text-error text-center' role='alert'>{t('Something went wrong. Please try again.')}</p>}
            </>
          )}

          {settingsPageOnly && (
            <>
              <h1 className='text-xl font-bold mb-3 text-center'>{t('Choose which emails you get')}</h1>
              <p className='mb-0 text-foreground/80 text-center'>
                {t('This email has no single switch to turn off. You can choose which emails you get here:')} {settingsLink}
              </p>
            </>
          )}

          {status === 'done' && (
            <div role='status'>
              <h1 className='text-xl font-bold mb-3 text-center'>{t("You're unsubscribed.")}</h1>
              <p className='mb-0 text-foreground/80 text-center'>
                {t('You can change this any time:')} {settingsLink}
              </p>
            </div>
          )}

          {status === 'invalid' && (
            <>
              <h1 className='text-xl font-bold mb-3 text-center'>{t("This unsubscribe link has expired or isn't valid.")}</h1>
              <p className='mb-0 text-foreground/80 text-center'>
                {t('You can choose which emails you get here:')} {settingsLink}
              </p>
            </>
          )}

          {status === 'error' && (
            <p className='mb-0 text-error text-center' role='alert'>{t('Something went wrong. Please try again.')}</p>
          )}
        </div>
      </div>
    </>
  )
}

// The same page for someone who is signed in, outside the signed-in app's layout
export function EmailUnsubscribePage () {
  return (
    <div className='min-h-screen w-full flex items-center justify-center bg-background p-4'>
      <EmailUnsubscribe className='w-full' />
    </div>
  )
}
