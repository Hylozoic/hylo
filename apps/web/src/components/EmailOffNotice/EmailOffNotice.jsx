import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { MailX } from 'lucide-react'
import { cn } from 'util/index'
import { NOTIFICATION_SETTINGS_PATH, emailOffState, fetchEmailUnsubscribeScope } from './EmailOffNotice.store'

/**
 * Says that email from this group is off, because of the member's own settings or a
 * saved choice to get less email that also covers groups joined later (D11), with a
 * link to change it. Renders nothing while email is on.
 */
export default function EmailOffNotice ({ membershipSettings, className }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [unsubscribeScope, setUnsubscribeScope] = useState(null)
  const emailOffInGroup = membershipSettings?.sendEmail === false

  useEffect(() => {
    if (emailOffInGroup) return
    let current = true
    Promise.resolve(dispatch(fetchEmailUnsubscribeScope()))
      .then(result => {
        if (current) setUnsubscribeScope(result?.payload?.data?.me?.settings?.emailUnsubscribeScope || null)
      })
      .catch(() => { /* optional: say nothing if the check fails */ })
    return () => { current = false }
  }, [emailOffInGroup])

  const state = emailOffState(membershipSettings, unsubscribeScope)
  if (!state) return null

  return (
    <div className={cn('flex items-start gap-2 text-sm text-foreground/80', className)} data-testid='email-off-notice'>
      <MailX className='w-4 h-4 mt-0.5 shrink-0' aria-hidden='true' />
      <p className='m-0'>
        {state === 'off'
          ? t('Email from this group is off.')
          : t('Email from this group is off, except mentions and replies to you.')}
        {' '}
        <Link to={NOTIFICATION_SETTINGS_PATH} className='underline text-foreground hover:text-selected'>
          {t('Change email settings')}
        </Link>
      </p>
    </div>
  )
}
