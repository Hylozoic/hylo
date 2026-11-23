import { HeartHandshake } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { confirmSupportIntent, supportErrorCode } from 'store/actions/supportHylo'

/**
 * /support/thanks (#1754): where Open Collective sends people back after a
 * contribution. OC appends orderIdV2 (and status) to the URL; that id comes
 * from the browser, so the backend re-fetches and checks the order before
 * linking anything. If the check can't run, the daily sync still matches
 * contributions started from Hylo.
 */
export default function SupportThanks () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const { setHeaderDetails } = useViewHeader()
  const orderId = new URLSearchParams(location.search).get('orderIdV2')
  const [state, setState] = useState(orderId ? { status: 'loading' } : { status: 'missing' })

  useEffect(() => {
    setHeaderDetails({ title: t('Support Hylo'), icon: <HeartHandshake />, search: false })
  }, [])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    dispatch(confirmSupportIntent(orderId))
      .then(res => {
        const result = res?.payload?.data?.confirmSupportIntent
        if (!result) throw res
        if (!cancelled) setState({ status: result.outcome, group: result.group, supporterStatus: result.supporterStatus })
      })
      .catch(e => {
        if (cancelled) return
        const code = supportErrorCode(e)
        setState({ status: code === 'OPEN_COLLECTIVE_NOT_CONFIGURED' ? 'notConfigured' : code === 'SUPPORT_ORDER_NOT_PAID' ? 'notPaid' : 'error' })
      })
    return () => { cancelled = true }
  }, [orderId])

  if (state.status === 'loading') {
    return (
      <div className='flex flex-col items-center p-8' data-testid='support-thanks' data-status='loading'>
        <Loading />
        <p className='text-foreground/70'>{t('Checking your contribution...')}</p>
      </div>
    )
  }

  const messages = {
    confirmed: state.group
      ? t('Your contribution is linked to your account and counts for {{groupName}} too.', { groupName: state.group.name })
      : t('Your contribution is linked to your account.'),
    email_match: t('We found your contribution through your email address and linked it to your account.'),
    pending: t('Open Collective is still processing your contribution. Your supporter status will update once it has been paid.'),
    unmatched: t("We couldn't link this contribution to your account automatically. If you used a different email address on Open Collective, contact us and we'll sort it out."),
    notConfigured: t('Linking contributions to Hylo accounts isn\'t available yet. Your contribution will be matched as soon as it is.'),
    notPaid: t("Open Collective says this contribution wasn't completed, so nothing was charged."),
    error: t("We couldn't check your contribution right now. Don't worry: contributions started from Hylo are matched automatically within a day."),
    missing: t('Thank you for supporting Hylo!')
  }
  const success = ['confirmed', 'email_match', 'pending', 'notConfigured', 'missing'].includes(state.status)

  return (
    <div className='max-w-xl mx-auto p-6 sm:p-10 text-center' data-testid='support-thanks' data-status={state.status}>
      <Helmet><title>{t('Support Hylo')} | Hylo</title></Helmet>
      <HeartHandshake className='mx-auto h-12 w-12 text-pink-500 mb-4' aria-hidden='true' />
      <h1 className='text-2xl font-bold text-foreground mb-3'>
        {success ? t('Thank you for supporting Hylo!') : t('Support Hylo')}
      </h1>
      <p className='text-foreground/80'>{messages[state.status] || messages.error}</p>
      {(state.status === 'confirmed' || state.status === 'email_match') && (
        <p className='text-foreground/70 text-sm'>
          {t('Your supporter badge is off until you turn it on in your settings.')}
        </p>
      )}
      <Link
        to='/my/support'
        className='inline-block mt-4 rounded-md bg-selected px-4 py-2 text-sm font-semibold text-foreground hover:bg-selected/90'
      >
        {t('Go to your Support Hylo settings')}
      </Link>
    </div>
  )
}
