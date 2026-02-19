import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Div100vh from 'react-div-100vh'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import HyloHTML from 'components/HyloHTML'
import { CreditCard, LogIn } from 'lucide-react'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import { offeringUrl, origin } from '@hylo/navigation'
import { offeringGrantsGroupAccess, parseAccessGrants } from 'util/accessGrants'
import { createStripeCheckoutSession } from 'util/offerings'
import fetchPublicStripeOffering from 'store/actions/fetchPublicStripeOffering'
import getCommonRoles from 'store/selectors/getCommonRoles'
import getMe from 'store/selectors/getMe'
import setReturnToPath from 'store/actions/setReturnToPath'

/**
 * OfferingDetails Component
 *
 * Displays details for a single offering, accessible via direct link.
 * This component is accessible without authentication and supports both
 * published and unlisted offerings.
 */
export default function OfferingDetails () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { offeringId } = useParams()
  const currentUser = useSelector(getMe)
  const [offering, setOffering] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  // TODO STRIPE: this page is accessable outside auth. Still need to handle what happens when someone pays without an account

  useEffect(() => {
    if (!offeringId) {
      setError(t('Invalid offering ID'))
      setLoading(false)
      return
    }

    const loadOffering = async () => {
      try {
        setLoading(true)
        setError(null)

        const result = await dispatch(fetchPublicStripeOffering({ offeringId }))
        const responseData = result.payload?.getData ? result.payload.getData() : result.payload?.data?.publicStripeOffering

        if (responseData) {
          setOffering(responseData)
        } else {
          setError(t('Offering not found'))
        }
      } catch (err) {
        console.error('Error loading offering:', err)
        setError(err.message || t('Failed to load offering'))
      } finally {
        setLoading(false)
      }
    }

    loadOffering()
  }, [dispatch, offeringId, t])

  // Get common roles for role lookup
  const commonRoles = useSelector(getCommonRoles)

  // Check if this offering grants access to the owning group
  const grantsGroupAccess = useMemo(() => {
    if (!offering?.group || !offering) return false
    return offeringGrantsGroupAccess(offering, offering.group.id)
  }, [offering])

  /**
   * Creates a Stripe checkout session and redirects to payment
   * Non-authenticated users are redirected to sign-up first
   */
  const handlePurchase = useCallback(async () => {
    if (!offering?.id || !offering?.group?.id) {
      alert(t('Unable to process payment. Please contact support.'))
      return
    }

    // Redirect non-authenticated users to sign-up, then back to this page
    if (!currentUser) {
      const returnToUrl = location.pathname + location.search
      dispatch(setReturnToPath(returnToUrl))
      navigate('/login?returnToUrl=' + encodeURIComponent(returnToUrl))
      return
    }

    setCheckoutLoading(true)

    try {
      const baseUrl = origin()
      const successUrl = `${baseUrl}/groups/${offering.group.slug}/payment/success`
      const cancelUrl = baseUrl + offeringUrl(offeringId, offering.group.slug)

      const checkoutData = await createStripeCheckoutSession({
        groupId: offering.group.id,
        offeringId: offering.id,
        quantity: 1,
        successUrl,
        cancelUrl,
        metadata: {
          groupSlug: offering.group.slug,
          offeringId: offering.id
        }
      })

      // Redirect to Stripe checkout
      window.location.href = checkoutData.url
    } catch (err) {
      console.error('Error creating checkout session:', err)
      alert(t('Failed to start payment process: {{error}}', { error: err.message }))
      setCheckoutLoading(false)
    }
  }, [offering, offeringId, t])

  if (loading) {
    return <Loading type='fullscreen' />
  }

  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-foreground mb-4'>{t('Error')}</h1>
          <p className='text-foreground/70'>{error}</p>
        </div>
      </div>
    )
  }

  if (!offering) {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-foreground mb-4'>{t('Offering Not Found')}</h1>
          <p className='text-foreground/70'>{t('The offering you are looking for does not exist.')}</p>
        </div>
      </div>
    )
  }

  const group = offering.group

  return (
    <Div100vh className='flex flex-col bg-background overflow-hidden'>
      <div className='flex-1 overflow-y-auto w-full'>
        {/* Banner and Avatar Header */}
        {group && (
          <div
            className='w-full py-12 px-4 bg-cover bg-center overflow-hidden relative shadow-xl'
            style={{ backgroundImage: `url(${group.bannerUrl || DEFAULT_BANNER})` }}
          >
            <div className='bottom-0 right-0 bg-black/50 absolute top-0 left-0 z-0' />
            <div className='max-w-4xl mx-auto flex items-center justify-center flex-col relative z-10'>
              <img
                src={group.avatarUrl || DEFAULT_AVATAR}
                alt={group.name}
                className='w-24 h-24 rounded-xl shadow-xl mb-4'
              />
              <div className='text-white font-bold text-2xl text-center mb-2'>
                {group.name}
              </div>
            </div>
          </div>
        )}

        {/* Offering Details Content */}
        <div className='max-w-4xl mx-auto p-6 pb-12 w-full'>
        <div className='bg-midground rounded-xl p-6 shadow-lg'>
          <h1 className='text-4xl font-bold text-foreground mb-4'>{offering.name}</h1>

          {offering.description && (
            <p className='text-lg text-foreground/70 mb-6 leading-relaxed'>{offering.description}</p>
          )}

          <div className='flex flex-col gap-4 mb-6'>
            {offering.priceInCents && (
              <div className='flex items-center gap-2'>
                <span className='text-2xl font-bold text-foreground'>
                  ${(offering.priceInCents / 100).toFixed(2)}
                </span>
                <span className='text-lg text-foreground/70'>
                  {offering.currency?.toUpperCase()}
                </span>
              </div>
            )}

            {offering.duration
              ? (
                <div className='text-foreground/70'>
                  <span className='font-semibold'>{t('Duration')}: </span>
                  <span>
                    {offering.duration === 'month' ? t('1 Month') : offering.duration === 'season' ? t('1 Season') : offering.duration === 'annual' ? t('1 Year') : offering.duration}
                  </span>
                </div>
                )
              : (
                <div className='text-foreground/70'>
                  <span className='font-semibold'>{t('Duration')}: </span>
                  <span>{t('Lifetime')}</span>
                </div>
                )}
          </div>

          {/* Access Grants Section */}
          {(() => {
            // Lookup roles from group context using IDs from accessGrants
            const accessGrants = parseAccessGrants(offering.accessGrants)
            const groupRoles = group?.groupRoles?.items || []
            const allRoles = []

            if (accessGrants.groupRoleIds && Array.isArray(accessGrants.groupRoleIds)) {
              accessGrants.groupRoleIds.forEach(roleId => {
                const role = groupRoles.find(r => parseInt(r.id) === parseInt(roleId))
                if (role) allRoles.push(role)
              })
            }

            if (accessGrants.commonRoleIds && Array.isArray(accessGrants.commonRoleIds)) {
              accessGrants.commonRoleIds.forEach(roleId => {
                const role = commonRoles.find(r => parseInt(r.id) === parseInt(roleId))
                if (role) allRoles.push(role)
              })
            }
            const hasTracks = offering.tracks && offering.tracks.length > 0
            const hasRoles = allRoles.length > 0
            return (grantsGroupAccess || hasTracks || hasRoles) && (
              <div className='border-t border-foreground/10 pt-6 mt-6'>
                {grantsGroupAccess && (
                  <p className='text-sm font-bold text-foreground mb-4'>
                    {t('Grants access to the group')}
                  </p>
                )}

                {(hasTracks || hasRoles)
                  ? (
                    <>
                      <p className='text-xs font-semibold text-foreground/70 mb-3'>
                        {t('Grants access to')}:
                      </p>
                      <div className='flex flex-col gap-3'>
                        {hasTracks && (
                          <div>
                            <span className='font-medium text-sm text-foreground/70 mb-2 block'>
                              {t('Tracks')}:
                            </span>
                            <div className='flex flex-wrap gap-2'>
                              {offering.tracks.map(track => (
                                <div
                                  key={track.id}
                                  className='inline-flex items-center gap-2 px-3 py-2 rounded-md bg-selected/20 text-foreground'
                                >
                                  {track.bannerUrl && (
                                    <img
                                      src={track.bannerUrl}
                                      alt={track.name}
                                      className='w-8 h-8 rounded object-cover'
                                    />
                                  )}
                                  <div className='flex flex-col'>
                                    <span className='text-sm font-medium'>{track.name}</span>
                                    {track.description && (
                                      <div className='text-xs text-foreground/70 line-clamp-1'>
                                        <HyloHTML html={track.description} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {hasRoles && (
                          <div>
                            <span className='font-medium text-sm text-foreground/70 mb-2 block'>
                              {t('Roles')}:
                            </span>
                            <div className='flex flex-wrap gap-2'>
                              {allRoles.map(role => (
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
                    </>
                    )
                  : null}
              </div>
            )
          })()}

          {/* Buy Now Button */}
          <div className='border-t border-foreground/10 pt-6 mt-6'>
            <Button
              variant='primary'
              size='lg'
              className='w-full flex items-center justify-center gap-2'
              onClick={handlePurchase}
              disabled={checkoutLoading}
            >
              {currentUser
                ? (
                  <>
                    <CreditCard className='w-5 h-5' />
                    {checkoutLoading ? t('Processing...') : t('Buy Now')}
                  </>
                  )
                : (
                  <>
                    <LogIn className='w-5 h-5' />
                    {t('Sign up to Purchase')}
                  </>
                  )}
            </Button>
            <p className='text-xs text-foreground/60 mt-3 text-center'>
              {t('You\'ll have the option to add a donation to Hylo during checkout')}
            </p>
          </div>
        </div>
      </div>
      </div>
    </Div100vh>
  )
}
