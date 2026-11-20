import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, Check, CheckCircle2, Sparkles } from 'lucide-react'
import { formatCurrencyAmount } from '@hylo/shared'
import Loading from 'components/Loading'
import SupportHyloModal from 'components/SupportHyloModal/SupportHyloModal'
import Button from 'components/ui/button'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { formatLocalizedDate } from 'util/dateFormat'
import { runGraphql } from 'util/graphql'
import { cn } from 'util/index'
import { getDateLocale } from 'util/locale'
import { activateProCheckoutSession, createProCheckoutSession, createProPortalSession, fetchProBilling } from './BillingTab.store'
import { CONTACT_EMAIL, TIERS, tierCardFor } from './tiers'

// On return from Checkout the page activates the subscription right away; if Stripe is still
// processing the payment, poll briefly (the webhook also syncs it)
const ACTIVATION_POLL_MS = 2000
const ACTIVATION_POLL_ATTEMPTS = 15
const ALREADY_SUBSCRIBED = 'HYLO_PRO_ALREADY_SUBSCRIBED'

// GraphQL errors from the server carry a path or extensions; anything else is a network problem
function isServerError (error) {
  return !!(error?.extensions || error?.path)
}

export default function BillingTab ({ group }) {
  const { t } = useTranslation()
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
  // Which Pro price the Pro card shows and its Upgrade button starts Checkout for
  const [proInterval, setProInterval] = useState('month')
  const [supportOpen, setSupportOpen] = useState(false)

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

  // Dates and prices follow the user's Hylo locale setting (en-GB is day first), never the browser's
  const formatDate = value => formatLocalizedDate(value, { style: 'long' }) || ''
  const formatPrice = plan => formatCurrencyAmount(plan.unitAmount, plan.currency, getDateLocale(), { dropZeroFraction: true })

  const subscription = billing?.subscription
  const grant = billing?.grant
  const hasPro = !!billing?.hasPro
  const paidActive = !!subscription?.active
  // Right after Checkout, wait for the new subscription instead of offering a second one
  const awaitingActivation = checkoutResult === 'success' && !hasPro && !activationTimedOut
  const showUpgrade = !!billing?.canUpgrade && !awaitingActivation
  const plans = billing?.plans || []
  // While the group pays for Pro, the Pro card shows the price of the interval it is on
  const shownInterval = paidActive && subscription.interval ? subscription.interval : proInterval
  const proPlan = plans.find(plan => plan.interval === shownInterval) || plans[0]

  // The tier the group is on ('pro', 'pro_plus', 'custom'), and the card that sells it
  const currentTier = hasPro ? (billing.tier || 'pro') : null
  const currentCard = currentTier ? tierCardFor(currentTier) : null
  const tierName = {
    pro: t('Hylo Pro'),
    pro_plus: t('Hylo Pro Plus'),
    custom: t('Hylo Custom')
  }[currentTier] || t('Hylo Pro')

  let planName = t('Free')
  let planDetail = null
  if (paidActive) {
    planName = subscription.interval === 'year' ? t('{{plan}} (yearly)', { plan: tierName }) : t('{{plan}} (monthly)', { plan: tierName })
    // A failed renewal keeps Pro for a short grace period; the payment-failed banner explains it
    planDetail = subscription.cancelAtPeriodEnd
      ? t('Cancels on {{date}}. Pro features stay on until then.', { date: formatDate(subscription.endsAt || subscription.currentPeriodEnd) })
      : !billing.needsPaymentUpdate && subscription.currentPeriodEnd && t('Renews on {{date}}', { date: formatDate(subscription.currentPeriodEnd) })
  } else if (grant) {
    planName = t('{{plan}} (granted by Hylo)', { plan: tierName })
    planDetail = grant.endsAt
      ? t('Pro access until {{date}}', { date: formatDate(grant.endsAt) })
      : t('No end date')
  } else if (subscription?.endedAt && !billing?.needsPaymentUpdate) {
    planDetail = t('Your Hylo Pro subscription ended on {{date}}.', { date: formatDate(subscription.endedAt) })
  }

  const priceFor = plan => plan.interval === 'year'
    ? t('{{price}}/year', { price: formatPrice(plan) })
    : t('{{price}}/month', { price: formatPrice(plan) })

  // Price line of a tier card
  const renderPrice = tier => {
    switch (tier.priceKind) {
      case 'any': return t('Any amount')
      case 'plans': return proPlan ? priceFor(proPlan) : null
      case 'comingSoon': return t('Coming soon')
      case 'contact': return t('Contact us')
      default: return null
    }
  }

  // Call to action of a tier card. The card of the group's tier shows "Current plan" instead of
  // its button while the group has Pro; Manage subscription stays below the cards
  const renderCta = tier => {
    if (currentCard && tier.id === currentCard.id) {
      return (
        <span className='inline-flex items-center justify-center gap-1 rounded-md bg-selected/20 px-3 py-2 text-sm font-medium text-foreground' data-testid='billing-current-plan'>
          <Sparkles className='w-4 h-4 text-selected' />
          {t('Current plan')}
        </span>
      )
    }
    switch (tier.ctaKind) {
      case 'support':
        return (
          <Button className='w-full' onClick={() => setSupportOpen(true)} data-testid='billing-support-hylo'>
            {t('Support Hylo')}
          </Button>
        )
      case 'upgrade':
        if (hasPro || !showUpgrade || !proPlan) return null
        return (
          <Button
            className='w-full'
            disabled={!!redirecting}
            onClick={() => upgrade(proPlan.interval)}
            data-testid={`billing-upgrade-${proPlan.interval}`}
          >
            {proPlan.interval === 'year' ? t('Upgrade yearly') : t('Upgrade monthly')}
          </Button>
        )
      case 'comingSoon':
        return <Button className='w-full' disabled data-testid='billing-coming-soon'>{t('Coming soon')}</Button>
      case 'contact':
        return (
          <Button asChild className='w-full'>
            <a href={`mailto:${CONTACT_EMAIL}`} data-testid='billing-contact-us'>{t('Contact us')}</a>
          </Button>
        )
      default:
        return null
    }
  }

  // The cards are narrow at the xl breakpoint, so the two choices share the width and may wrap
  const intervalChoice = 'flex-1 rounded-md border-2 px-3 py-1 text-sm font-medium transition-all'
  const intervalSelected = 'border-selected bg-selected/20 text-foreground'
  const intervalUnselected = 'border-foreground/20 text-foreground/80 hover:border-foreground/50'

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

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3' data-testid='billing-tiers'>
        {TIERS.map(tier => {
          const isPro = tier.id === 'pro'
          const isCurrent = !!currentCard && tier.id === currentCard.id
          const price = renderPrice(tier)
          return (
            <div
              key={tier.id}
              className={cn(
                'rounded-xl border-2 p-4 flex flex-col gap-3',
                isCurrent ? 'border-selected' : 'border-foreground/10'
              )}
              data-testid={`billing-tier-${tier.id}`}
            >
              <div className='flex flex-col gap-1'>
                <h3 className='text-lg font-bold text-foreground flex items-center gap-2'>
                  {isPro && <Sparkles className='w-5 h-5 text-selected' />}
                  {t(tier.nameKey)}
                </h3>
                {tier.subtitleKey && <p className='text-sm text-foreground/70'>{t(tier.subtitleKey)}</p>}
                {price && <p className='text-foreground font-semibold' data-testid={`billing-tier-${tier.id}-price`}>{price}</p>}
              </div>

              {isPro && !hasPro && plans.length > 1 && (
                <div className='flex flex-wrap gap-2' role='group'>
                  {plans.map(plan => (
                    <button
                      key={plan.interval}
                      type='button'
                      className={cn(intervalChoice, plan.interval === proPlan?.interval ? intervalSelected : intervalUnselected)}
                      onClick={() => setProInterval(plan.interval)}
                      data-testid={`billing-interval-${plan.interval}`}
                    >
                      {plan.interval === 'year' ? t('Yearly') : t('Monthly')}
                    </button>
                  ))}
                </div>
              )}

              <ul className='flex flex-col gap-1 text-sm text-foreground/80 flex-1'>
                {tier.features.map(feature => (
                  <li key={feature.labelKey} className='flex items-start gap-2' data-feature-keys={feature.keys.join(' ') || undefined}>
                    <Check className='w-4 h-4 mt-0.5 shrink-0 text-selected' />
                    <span>{t(feature.labelKey)}</span>
                  </li>
                ))}
              </ul>

              {renderCta(tier)}
            </div>
          )
        })}
      </div>

      <SupportHyloModal open={supportOpen} onOpenChange={setSupportOpen} initialGroupId={group.id} />

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
