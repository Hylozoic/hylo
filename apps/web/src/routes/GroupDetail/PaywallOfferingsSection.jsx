import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { DollarSign, CreditCard } from 'lucide-react'
import { getHost } from 'store/middleware/apiMiddleware'
import fetchPublicStripeOfferings from 'store/actions/fetchPublicStripeOfferings'
import { createStripeCheckoutSession } from 'util/offerings'
import { offeringGrantsGroupAccess } from 'util/accessGrants'

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
          <OfferingCard
            key={offering.id}
            offering={offering}
            group={group}
            checkoutLoading={checkoutLoading}
            onPurchase={handlePurchase}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * OfferingCard Component
 *
 * Displays a single offering with its details and what access it grants
 */
function OfferingCard ({ offering, group, checkoutLoading, onPurchase, t }) {
  const grantsGroupAccess = useMemo(() => {
    if (!group?.id || !offering) return false
    return offeringGrantsGroupAccess(offering, group.id)
  }, [offering, group?.id])

  const hasTracks = offering.tracks && offering.tracks.length > 0
  const hasRoles = offering.roles && offering.roles.length > 0
  const hasAccessGrants = grantsGroupAccess || hasTracks || hasRoles

  return (
    <div className='border-2 border-foreground/20 rounded-lg p-4 hover:border-foreground/40 transition-colors'>
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

      {/* Access Grants Section */}
      {hasAccessGrants && (
        <div className='border-t border-foreground/10 pt-3 mt-3'>
          {grantsGroupAccess && (
            <p className='text-sm font-semibold text-foreground mb-2'>
              {t('Grants access to the group')}
            </p>
          )}

          {(hasTracks || hasRoles) && (
            <div className='flex flex-col gap-2'>
              {hasTracks && (
                <div>
                  <span className='text-xs font-medium text-foreground/70 mb-1 block'>
                    {t('Tracks')}:
                  </span>
                  <div className='flex flex-wrap gap-1'>
                    {offering.tracks.map(track => (
                      <div
                        key={track.id}
                        className='inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-selected/20 text-foreground text-sm'
                      >
                        {track.bannerUrl && (
                          <img
                            src={track.bannerUrl}
                            alt={track.name}
                            className='w-5 h-5 rounded object-cover'
                          />
                        )}
                        <span>{track.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasRoles && (
                <div>
                  <span className='text-xs font-medium text-foreground/70 mb-1 block'>
                    {t('Roles')}:
                  </span>
                  <div className='flex flex-wrap gap-1'>
                    {offering.roles.map(role => (
                      <span
                        key={role.id}
                        className='inline-flex items-center gap-1 px-2 py-1 rounded-md bg-selected/20 text-foreground text-sm'
                      >
                        {role.emoji && <span>{role.emoji}</span>}
                        <span>{role.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Button
        variant='secondary'
        className='w-full mt-3 flex items-center justify-center gap-2'
        onClick={() => onPurchase(offering)}
        disabled={checkoutLoading === offering.id}
      >
        <CreditCard className='w-4 h-4' />
        {checkoutLoading === offering.id ? t('Processing...') : t('Purchase Access')}
      </Button>
    </div>
  )
}
