import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { fetchProSubscription, createProCheckoutSession, createProPortalSession } from './BillingTab.store'

// Keep in sync with PLANS in apps/backend/api/services/HyloProService.js
const PLAN_PRICES = { month: 10, year: 100 }
// After Checkout the subscription arrives by webhook, so poll briefly for it
const ACTIVATION_POLL_MS = 2000
const ACTIVATION_POLL_ATTEMPTS = 15
const UNPAID_STATUSES = ['past_due', 'unpaid']

// Redux GraphQL actions can resolve with an error or reject; treat both as failure
async function runGraphql (dispatch, action, field) {
  const result = await dispatch(action)
  if (result?.error) throw result.payload || new Error('GraphQL error')
  return result?.payload?.data?.[field]
}

export default function BillingTab ({ group }) {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const [searchParams] = useSearchParams()
  const checkoutResult = searchParams.get('checkout')

  const [subscription, setSubscription] = useState(null)
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

  const load = useCallback(async () => {
    try {
      const data = await runGraphql(dispatch, fetchProSubscription(group.id), 'group')
      setSubscription(data?.proSubscription || null)
      setError(null)
      return data?.proSubscription || null
    } catch (e) {
      setError(t('Oh no, something went wrong! Check your internet connection and try again'))
      return null
    } finally {
      setLoaded(true)
    }
  }, [dispatch, group?.id])

  useEffect(() => {
    if (!group?.id) return
    let cancelled = false
    let attempts = 0
    let timer

    const poll = async () => {
      const current = await load()
      if (cancelled) return
      attempts++
      if (checkoutResult === 'success' && !current?.active) {
        if (attempts < ACTIVATION_POLL_ATTEMPTS) {
          timer = setTimeout(poll, ACTIVATION_POLL_MS)
        } else {
          setActivationTimedOut(true)
        }
      }
    }
    poll()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [group?.id, checkoutResult, load])

  const redirectTo = async (key, action, field) => {
    setRedirecting(key)
    setError(null)
    try {
      const session = await runGraphql(dispatch, action, field)
      if (!session?.url) throw new Error('No URL returned')
      window.location.href = session.url
    } catch (e) {
      setRedirecting(null)
      setError(t('Oh no, something went wrong! Check your internet connection and try again'))
    }
  }

  const upgrade = interval => redirectTo(interval, createProCheckoutSession(group.id, interval), 'createHyloProCheckoutSession')
  const manage = () => redirectTo('portal', createProPortalSession(group.id), 'createHyloProPortalSession')

  if (!group || !loaded) return <Loading />

  const formatDate = value => value ? new Date(value).toLocaleDateString(i18n.language, { dateStyle: 'long' }) : ''
  const formatPrice = amount => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)

  const active = !!subscription?.active
  const isStripe = subscription?.source === 'stripe'
  const isUnpaid = isStripe && UNPAID_STATUSES.includes(subscription.status)
  const canUpgrade = !active && !isUnpaid
  const canManage = isStripe

  let planName = t('Free')
  if (active && isStripe) planName = subscription.interval === 'year' ? t('Hylo Pro (yearly)') : t('Hylo Pro (monthly)')
  if (active && !isStripe) planName = t('Hylo Pro (granted by Hylo)')

  let planDetail = null
  if (active && isStripe) {
    planDetail = subscription.cancelAtPeriodEnd
      ? t('Cancels on {{date}}. Pro features stay on until then.', { date: formatDate(subscription.endsAt || subscription.currentPeriodEnd) })
      : subscription.currentPeriodEnd && t('Renews on {{date}}', { date: formatDate(subscription.currentPeriodEnd) })
  } else if (active) {
    planDetail = subscription.endsAt
      ? t('Pro access until {{date}}', { date: formatDate(subscription.endsAt) })
      : t('No end date')
  } else if (subscription?.endedAt && !isUnpaid) {
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
            {active
              ? t('Thanks for upgrading to Hylo Pro!')
              : activationTimedOut
                ? t('Thanks for upgrading! It is taking longer than usual to confirm your payment. Refresh this page in a few minutes.')
                : t('Thanks for upgrading! Your Hylo Pro subscription will appear here in a moment.')}
          </span>
        </div>
      )}

      {checkoutResult === 'canceled' && !active && (
        <div className='rounded-lg bg-foreground/5 p-3 text-foreground/70' data-testid='billing-checkout-canceled'>
          {t('Checkout was canceled. You have not been charged.')}
        </div>
      )}

      {isUnpaid && (
        <div className='flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-foreground' data-testid='billing-payment-failed'>
          <AlertCircle className='w-5 h-5 shrink-0 text-destructive' />
          <span>{t('Your last payment failed. Update your payment method to keep Hylo Pro.')}</span>
        </div>
      )}

      {error && <p className='text-destructive'>{error}</p>}

      <div className='rounded-xl border-2 border-foreground/10 p-4 flex flex-col gap-1'>
        <span className='text-xs uppercase tracking-wide text-foreground/50'>{t('Current plan')}</span>
        <div className='flex items-center gap-2 text-lg font-bold text-foreground' data-testid='billing-plan-name'>
          {active && <Sparkles className='w-5 h-5 text-selected' />}
          {planName}
        </div>
        {planDetail && <p className='text-foreground/70' data-testid='billing-plan-detail'>{planDetail}</p>}
      </div>

      {canUpgrade && (
        <div className='flex flex-col sm:flex-row gap-3'>
          <Button
            className='flex-1 min-w-0 h-auto py-3 flex flex-col items-center'
            disabled={!!redirecting}
            onClick={() => upgrade('month')}
            data-testid='billing-upgrade-month'
          >
            <span className='font-bold'>{t('Upgrade monthly')}</span>
            <span className='text-sm opacity-80'>{t('{{price}}/month', { price: formatPrice(PLAN_PRICES.month) })}</span>
          </Button>
          <Button
            className='flex-1 min-w-0 h-auto py-3 flex flex-col items-center'
            disabled={!!redirecting}
            onClick={() => upgrade('year')}
            data-testid='billing-upgrade-year'
          >
            <span className='font-bold'>{t('Upgrade yearly')}</span>
            <span className='text-sm opacity-80'>{t('{{price}}/year', { price: formatPrice(PLAN_PRICES.year) })}</span>
          </Button>
        </div>
      )}

      {canManage && (
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
