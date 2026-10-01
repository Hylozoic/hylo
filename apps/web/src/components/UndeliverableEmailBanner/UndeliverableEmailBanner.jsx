import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { MailWarning, X } from 'lucide-react'

export const FETCH_EMAIL_UNDELIVERABLE = 'UndeliverableEmailBanner/FETCH_EMAIL_UNDELIVERABLE'
export const DISMISS_STORAGE_KEY = 'hylo:undeliverableEmailBanner:dismissed'
export const ACCOUNT_SETTINGS_PATH = '/my/account'

export function fetchEmailUndeliverable () {
  return {
    type: FETCH_EMAIL_UNDELIVERABLE,
    graphql: {
      query: `
        query UndeliverableEmail {
          me {
            id
            emailUndeliverable
          }
        }
      `,
      variables: {}
    }
  }
}

function readDismissed () {
  try {
    return !!window.sessionStorage.getItem(DISMISS_STORAGE_KEY)
  } catch (e) {
    return false
  }
}

function rememberDismissed () {
  try {
    window.sessionStorage.setItem(DISMISS_STORAGE_KEY, '1')
  } catch (e) {
    // Without storage the card just stays hidden for this page view
  }
}

/**
 * Asks someone whose address bounced (D36) to fix it: until they do, Hylo sends them
 * only essential email. Dismissing hides it for this visit; it comes back next time
 * while the address is still undeliverable, and goes away once it is changed or verified.
 */
export default function UndeliverableEmailBanner () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [undeliverable, setUndeliverable] = useState(false)
  const [dismissed, setDismissed] = useState(readDismissed)

  const check = useCallback(() => {
    Promise.resolve(dispatch(fetchEmailUndeliverable()))
      .then(result => setUndeliverable(result?.payload?.data?.me?.emailUndeliverable === true))
      .catch(() => { /* optional chrome: say nothing if the check fails */ })
  }, [dispatch])

  useEffect(() => {
    check()
  }, [check])

  // While it shows, look again after each page change, so it goes once the address is fixed
  useEffect(() => {
    if (undeliverable) check()
  }, [pathname])

  const dismiss = useCallback(() => {
    rememberDismissed()
    setDismissed(true)
  }, [])

  if (!undeliverable || dismissed) return null

  // z-[60]: under the post composer (70) and the Android app card (65)
  return (
    <div className='fixed inset-x-0 top-0 z-[60] px-4 pt-3 pointer-events-none' data-testid='undeliverable-email-banner'>
      <div
        role='alert'
        className='pointer-events-auto mx-auto max-w-md rounded-xl border-2 border-accent-foreground/10 bg-accent text-accent-foreground shadow-2xl p-3 flex items-start gap-3'
      >
        <MailWarning className='w-5 h-5 mt-0.5 shrink-0' aria-hidden='true' />
        <div className='flex-1 min-w-0'>
          <p className='font-bold text-sm m-0'>{t("We can't deliver email to your address")}</p>
          <p className='text-xs mt-1 mb-0'>
            {t('Update your email address so you keep getting direct messages, mentions and account emails.')}
          </p>
          {pathname !== ACCOUNT_SETTINGS_PATH && (
            <button
              type='button'
              onClick={() => navigate(ACCOUNT_SETTINGS_PATH)}
              className='mt-2 bg-background text-foreground font-bold text-sm px-3 py-1.5 rounded-md hover:bg-background/85'
            >
              {t('Update email')}
            </button>
          )}
        </div>
        <button
          type='button'
          aria-label={t('Dismiss')}
          onClick={dismiss}
          className='p-1 rounded-full opacity-70 hover:opacity-100 shrink-0'
        >
          <X className='w-4 h-4' />
        </button>
      </div>
    </div>
  )
}
