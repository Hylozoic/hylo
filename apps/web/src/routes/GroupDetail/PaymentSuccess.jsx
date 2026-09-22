import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Button from 'components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { groupUrl, spaceUrl } from '@hylo/navigation'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import fulfillStripeCheckoutSession from 'store/actions/fulfillStripeCheckoutSession'

const PAYMENT_SUCCESS_REDIRECT_MS = 5000

/**
 * PaymentSuccess Component
 *
 * Displays a success message after a user completes a Stripe checkout
 * and redirects them to the group or space they purchased access to.
 */
export default function PaymentSuccess () {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { groupSlug } = useParams()
  const [searchParams] = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)
  const [ready, setReady] = useState(false)

  const sessionId = searchParams.get('session_id')
  const offeringId = searchParams.get('offering_id')
  const spaceSlug = searchParams.get('spaceSlug')
  const isSpacePurchase = Boolean(spaceSlug)

  const destination = useMemo(() => {
    if (groupSlug && spaceSlug) return spaceUrl(groupSlug, spaceSlug)
    if (groupSlug) return groupUrl(groupSlug)
    return '/'
  }, [groupSlug, spaceSlug])

  useEffect(() => {
    let cancelled = false

    async function fulfillAccess () {
      if (sessionId) {
        try {
          await dispatch(fulfillStripeCheckoutSession(sessionId, offeringId))
          await dispatch(fetchForCurrentUser())
        } catch (error) {
          console.error('Error fulfilling checkout session:', error)
        }
      }
      if (!cancelled) setReady(true)
    }

    fulfillAccess()
    return () => { cancelled = true }
  }, [dispatch, sessionId, offeringId])

  useEffect(() => {
    if (!ready || !destination || destination === '/') return undefined
    const timer = setTimeout(() => {
      setRedirecting(true)
      navigate(destination)
    }, PAYMENT_SUCCESS_REDIRECT_MS)
    return () => clearTimeout(timer)
  }, [ready, destination, navigate])

  const handleReturn = () => {
    if (!destination || destination === '/') return
    setRedirecting(true)
    navigate(destination)
  }

  if (!ready) {
    return (
      <div className='max-w-2xl mx-auto p-6'>
        <div className='bg-card p-8 rounded-lg text-center shadow-xl border-2 border-foreground/20'>
          <Loader2 className='w-16 h-16 mx-auto mb-4 animate-spin text-foreground/50' />
          <h2 className='text-2xl font-bold mb-2'>{t('Payment Successful!')}</h2>
          <p className='text-foreground/70'>{t('Granting access...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto p-6'>
      <div className='bg-card p-8 rounded-lg text-center shadow-xl border-2 border-foreground/20'>
        <CheckCircle className='w-16 h-16 mx-auto mb-4 text-green-500' />
        <h2 className='text-2xl font-bold mb-2'>{t('Payment Successful!')}</h2>
        <p className='text-foreground/70 mb-4'>
          {isSpacePurchase
            ? t('Thank you for your purchase. Your access to this space has been granted.')
            : t('Thank you for your purchase. Your access to this group has been granted.')}
        </p>
        {sessionId && (
          <p className='text-sm text-foreground/50 mb-6'>
            {t('Session ID')}: {sessionId}
          </p>
        )}
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Button
            onClick={handleReturn}
            disabled={redirecting}
            className='min-w-[200px]'
          >
            {redirecting
              ? (
                <>
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  {t('Redirecting...')}
                </>
                )
              : (
                  isSpacePurchase ? t('Go to Space') : t('Return to Group')
                )}
          </Button>
        </div>
        <p className='text-xs text-foreground/50 mt-4'>
          {t('You will be redirected automatically in a few seconds...')}
        </p>
      </div>
    </div>
  )
}
