import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { activateProCheckoutSession, createProCheckoutSession, createProPortalSession, fetchProBilling } from './BillingTab.store'

// On return from Checkout the page activates the subscription right away; if Stripe is still
// processing the payment, poll briefly (the webhook also syncs it)
const ACTIVATION_POLL_MS = 2000
const ACTIVATION_POLL_ATTEMPTS = 15
const ALREADY_SUBSCRIBED = 'HYLO_PRO_ALREADY_SUBSCRIBED'

// Redux GraphQL actions can resolve with an error or reject; treat both as failure
async function runGraphql (dispatch, action, field) {
  const result = await dispatch(action)
  if (result?.error) throw result.payload || new Error('GraphQL error')
  return result?.payload?.data?.[field]
}

// GraphQL errors from the server carry a path or extensions; anything else is a network problem
function isServerError (error) {
  return !!(error?.extensions || error?.path)
}

export default function BillingTab ({ group }) {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  // Read once: the params are removed from the URL when activation finishes (see clearCheckoutParams),
  // so a refresh or a shared link doesn't replay the checkout banner
  const [checkoutResult] = useState(() => searchParams.get('checkout'))
  const [checkoutSessionId] = useState(() => searchParams.get('session_id'))

  const [billing, setBilling] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [redirecting, setRedirecting] = useState(null)
  const [error, setError] = useState(null)
  const [activationTimedOut, setActivationTimedOut] = useState(false)

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: {
        desktop: `${t('Group Settings')} > ${t('Billing')}`,
        mobile: t('Billing')
      },
      icon: 'Settings'
    })
  }, [])

  // Coming back from Stripe restores this page from the back/forward cache with the buttons
  // still disabled; re-enable them
  useEffect(() => {
    const onPageShow = event => { if (event.persisted) setRedirecting(null) }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const connectionError = t('Oh no, something went wrong! Check your internet connection and try again')

  const load = useCallback(async () => {
    try {
      const data = await runGraphql(dispatch, fetchProBilling(group.id), 'group')
      const next = data?.proBilling || null
      setBilling(next)
      setError(null)
      return next
    } catch (e) {
      setError(connectionError)
      return null
    } finally {
      setLoaded(true)
    }
  }, [dispatch, group?.id])

  // setSearchParams changes whenever the URL does; a ref keeps clearing it from re-running the effect below
  const setSearchParamsRef = useRef(setSearchParams)
  setSearchParamsRef.current = setSearchParams
  const clearCheckoutParams = useCallback(() => {
    setSearchParamsRef.current(params => {
      const next = new URLSearchParams(params)
      next.delete('checkout')
      next.delete('session_id')
      return next
    }, { replace: true })
  }, [])

  useEffect(() => {
    if (!group?.id) return
    let cancelled = false
    let attempts = 0
    let timer

    const poll = async () => {
      const current = await load()
      if (cancelled) return
      attempts++
      if (checkoutResult === 'success' && !current?.hasPro && attempts < ACTIVATION_POLL_ATTEMPTS) {
        timer = setTimeout(poll, ACTIVATION_POLL_MS)
        return
      }
      if (checkoutResult === 'success' && !current?.hasPro) setActivationTimedOut(true)
      if (checkoutResult) clearCheckoutParams()
    }

    const start = async () => {
      if (checkoutResult === 'success' && checkoutSessionId) {
        // Best effort: if this fails, polling still picks up the webhook's sync
        try {
          await runGraphql(dispatch, activateProCheckoutSession(group.id, checkoutSessionId), 'activateHyloProCheckoutSession')
        } catch (e) {}
        if (cancelled) return
      }
      poll()
    }
    start()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [group?.id, checkoutResult, checkoutSessionId, load, clearCheckoutParams])

  const redirectTo = async (key, action, field) => {
    setRedirecting(key)
    setError(null)
    try {
      const session = await runGraphql(dispatch, action, field)
      if (!session?.url) throw new Error('No URL returned')
      window.location.href = session.url
    } catch (e) {
      setRedirecting(null)
      if (e?.extensions?.code === ALREADY_SUBSCRIBED) {
        // The server has just synced that subscription; show it and its Manage button
        await load()
        setError(t('This group already has a Hylo Pro subscription. Use Manage subscription to change it.'))
      } else {
        setError(isServerError(e) && e.message ? e.message : connectionError)
      }
    }
  }

  const upgrade = interval => redirectTo(interval, createProCheckoutSession(group.id, interval), 'createHyloProCheckoutSession')
  const manage = () => redirectTo('portal', createProPortalSession(group.id), 'createHyloProPortalSession')

  if (!group || !loaded) return <Loading />

  const formatDate = value => value ? new Date(value).toLocaleDateString(i18n.language, { dateStyle: 'long' }) : ''
  const formatPrice = plan => {
    const digits = plan.unitAmount % 100 === 0 ? 0 : 2
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: (plan.currency || 'usd').toUpperCase(),
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(plan.unitAmount / 100)
  }

  const subscription = billing?.subscription
  const grant = billing?.grant
  const hasPro = !!billing?.hasPro
  const paidActive = !!subscription?.active
  // Right after Checkout, wait for the new subscription instead of offering a second one
  const awaitingActivation = checkoutResult === 'success' && !hasPro && !activationTimedOut
  const showUpgrade = !!billing?.canUpgrade && !awaitingActivation
  const plans = billing?.plans || []

  let planName = t('Free')
  let planDetail = null
  if (paidActive) {
    planName = subscription.interval === 'year' ? t('Hylo Pro (yearly)') : t('Hylo Pro (monthly)')
    // A failed renewal keeps Pro for a short grace period; the payment-failed banner explains it
    planDetail = subscription.cancelAtPeriodEnd
      ? t('Cancels on {{date}}. Pro features stay on until then.', { date: formatDate(subscription.endsAt || subscription.currentPeriodEnd) })
      : !billing.needsPaymentUpdate && subscription.currentPeriodEnd && t('Renews on {{date}}', { date: formatDate(subscription.currentPeriodEnd) })
  } else if (grant) {
    planName = t('Hylo Pro (granted by Hylo)')
    planDetail = grant.endsAt
      ? t('Pro access until {{date}}', { date: formatDate(grant.endsAt) })
      : t('No end date')
  } else if (subscription?.endedAt && !billing?.needsPaymentUpdate) {
    planDetail = t('Your Hylo Pro subscription ended on {{date}}.', { date: formatDate(subscription.endedAt) })
  }

  return (
    <div className='flex flex-col gap-4' data-testid='billing-tab'>
      <div>
        <h2 className='text-foreground font-bold mb-2'>{t('Billing')}</h2>
        <p className='text-foreground/70'>{t('Upgrade your group to Hylo Pro to support Hylo and unlock Pro features.')}</p>
      </div>

      {checkoutResult === 'success' && (
        <div className='flex items-start gap-2 rounded-lg bg-selected/20 p-3 text-foreground' data-testid='billing-checkout-success'>
          <CheckCircle2 className='w-5 h-5 shrink-0 text-selected' />
          <span>
            {hasPro
              ? t('Thanks for upgrading to Hylo Pro!')
              : activationTimedOut
                ? t('Thanks for upgrading! It is taking longer than usual to confirm your payment. Refresh this page in a few minutes.')
                : t('Thanks for upgrading! Your Hylo Pro subscription will appear here in a moment.')}
          </span>
        </div>
      )}

      {checkoutResult === 'canceled' && !hasPro && (
        <div className='rounded-lg bg-foreground/5 p-3 text-foreground/70' data-testid='billing-checkout-canceled'>
          {t('Checkout was canceled. You have not been charged.')}
        </div>
      )}

      {billing?.needsPaymentUpdate && (
        <div className='flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-foreground' data-testid='billing-payment-failed'>
          <AlertCircle className='w-5 h-5 shrink-0 text-destructive' />
          <span>{t('Your last payment failed. Update your payment method to keep Hylo Pro.')}</span>
        </div>
      )}

      {error && <p className='text-destructive' data-testid='billing-error'>{error}</p>}

      <div className='rounded-xl border-2 border-foreground/10 p-4 flex flex-col gap-1'>
        <span className='text-xs uppercase tracking-wide text-foreground/50'>{t('Current plan')}</span>
        <div className='flex items-center gap-2 text-lg font-bold text-foreground' data-testid='billing-plan-name'>
          {hasPro && <Sparkles className='w-5 h-5 text-selected' />}
          {planName}
        </div>
        {planDetail && <p className='text-foreground/70' data-testid='billing-plan-detail'>{planDetail}</p>}
      </div>

      {showUpgrade && plans.length > 0 && (
        <div className='flex flex-col sm:flex-row gap-3'>
          {plans.map(plan => (
            <Button
              key={plan.interval}
              className='flex-1 min-w-0 h-auto py-3 flex flex-col items-center'
              disabled={!!redirecting}
              onClick={() => upgrade(plan.interval)}
              data-testid={`billing-upgrade-${plan.interval}`}
            >
              <span className='font-bold'>{plan.interval === 'year' ? t('Upgrade yearly') : t('Upgrade monthly')}</span>
              <span className='text-sm opacity-80'>
                {plan.interval === 'year'
                  ? t('{{price}}/year', { price: formatPrice(plan) })
                  : t('{{price}}/month', { price: formatPrice(plan) })}
              </span>
            </Button>
          ))}
        </div>
      )}

      {billing?.canManage && (
        <div className='flex flex-col gap-2'>
          <Button
            variant='outline'
            className='w-fit'
            disabled={!!redirecting}
            onClick={manage}
            data-testid='billing-manage'
          >
            {t('Manage subscription')}
          </Button>
          <p className='text-sm text-foreground/50'>{t('Cancel, switch between monthly and yearly, update your card or see invoices on Stripe.')}</p>
        </div>
      )}
    </div>
  )
}
