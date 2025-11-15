import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { DollarSign, CreditCard } from 'lucide-react'
import { getHost } from 'store/middleware/apiMiddleware'
import fetchPublicStripeOfferings from 'store/actions/fetchPublicStripeOfferings'
import { createStripeCheckoutSession } from 'util/offerings'

/**
 * PaywallOfferingsSection Component
 *
 * Displays available offerings for a paywalled group and allows users
 * to purchase access via Stripe checkout.
 */
export default function PaywallOfferingsSection ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [offerings, setOfferings] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(null)

  // Fetch offerings for the group using public query
  useEffect(() => {
    if (!group?.paywall || !group?.id) {
      setLoading(false)
      return
    }

    const loadOfferings = async () => {
      try {
        const result = await dispatch(fetchPublicStripeOfferings({ groupId: group.id }))
        const responseData = result.payload?.getData ? result.payload.getData() : result.payload?.data?.publicStripeOfferings

        if (responseData?.offerings) {
          setOfferings(responseData.offerings)
        }
      } catch (error) {
        console.error('Error loading offerings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadOfferings()
  }, [dispatch, group?.id, group?.paywall])

  /**
   * Creates a Stripe checkout session and redirects to payment
   */
  const handlePurchase = useCallback(async (offering) => {
    if (!group?.id || !offering?.id) {
      alert(t('Unable to process payment. Please contact support.'))
      return
    }

    setCheckoutLoading(offering.id)

    try {
      const baseUrl = getHost()
      const successUrl = `${baseUrl}/groups/${group.slug}/payment/success`
      const cancelUrl = `${baseUrl}/groups/${group.slug}/payment/cancel`

      const checkoutData = await createStripeCheckoutSession({
        groupId: group.id,
        offeringId: offering.id,
        quantity: 1,
        successUrl,
        cancelUrl,
        metadata: {
          groupSlug: group.slug
        }
      })

      // Redirect to Stripe checkout
      window.location.href = checkoutData.url
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert(t('Failed to start payment process: {{error}}', { error: error.message }))
      setCheckoutLoading(null)
    }
  }, [group, t])

  if (loading) {
    return (
      <div className='border-2 border-dashed border-foreground/20 rounded-xl p-4 text-center'>
        <p className='text-foreground/70'>{t('Loading payment options...')}</p>
      </div>
    )
  }

  if (offerings.length === 0) {
    return (
      <div className='border-2 border-dashed border-foreground/20 rounded-xl p-4 text-center'>
        <DollarSign className='w-12 h-12 mx-auto mb-2 text-foreground/50' />
        <h3 className='text-lg font-semibold mb-2'>{t('This group requires payment to join')}</h3>
        <p className='text-foreground/70 text-sm'>
          {t('No payment options are currently available. Please contact the group administrators.')}
        </p>
      </div>
    )
  }

  return (
    <div className='border-2 border-dashed border-foreground/20 rounded-xl p-4'>
      <div className='flex items-center gap-2 mb-4'>
        <DollarSign className='w-6 h-6 text-foreground' />
        <h3 className='text-lg font-semibold'>{t('This group requires a fee to join')}</h3>
      </div>
      <p className='text-foreground/70 text-sm mb-4'>
        {t('Choose a payment option below to gain access to this group:')}
      </p>
      <div className='flex flex-col gap-3'>
        {offerings.map(offering => (
          <div
            key={offering.id}
            className='border-2 border-foreground/20 rounded-lg p-4 hover:border-foreground/40 transition-colors'
          >
            <div className='flex items-start justify-between mb-2'>
              <div className='flex-1'>
                <h4 className='font-semibold text-foreground mb-1'>{offering.name}</h4>
                {offering.description && (
                  <p className='text-sm text-foreground/70 mb-2'>{offering.description}</p>
                )}
                <div className='flex items-center gap-4 text-sm text-foreground/60'>
                  {offering.priceInCents && (
                    <span>
                      {t('Price')}: ${(offering.priceInCents / 100).toFixed(2)} {offering.currency?.toUpperCase()}
                    </span>
                  )}
                  {offering.duration && (
                    <span>
                      {t('Duration')}: {offering.duration === 'month' ? t('1 Month') : offering.duration === 'season' ? t('1 Season') : offering.duration === 'annual' ? t('1 Year') : offering.duration}
                    </span>
                  )}
                  {!offering.duration && (
                    <span>{t('Duration')}: {t('Lifetime')}</span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant='secondary'
              className='w-full mt-3 flex items-center justify-center gap-2'
              onClick={() => handlePurchase(offering)}
              disabled={checkoutLoading === offering.id}
            >
              <CreditCard className='w-4 h-4' />
              {checkoutLoading === offering.id ? t('Processing...') : t('Purchase Access')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
