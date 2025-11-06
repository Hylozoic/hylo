/**
 * GroupStore Component
 * 
 * Public-facing storefront that displays offerings available for purchase
 * from a group's Stripe Connected Account.
 * 
 * Customers can browse offerings and initiate checkout sessions.
 * 
 * URL: /groups/:groupSlug/store
 * 
 * NOTE: In production, you should use a more stable identifier than
 * the Stripe account ID in URLs. Consider using your group slug or ID
 * and looking up the associated Stripe account ID from your database.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CreditCard, ShoppingCart, CheckCircle, ExternalLink } from 'lucide-react'

import Button from 'components/ui/button'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

/**
 * Main GroupStore component
 * 
 * Displays all offerings for a group and allows customers to purchase them
 */
function GroupStore () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { groupSlug } = useParams()

  // Get group from Redux store
  const group = useSelector(state => getGroupForSlug(state, groupSlug))

  // Local state for offerings and checkout
  const [state, setState] = useState({
    accountId: group?.stripeAccountId || '',
    offerings: [],
    loading: true,
    error: null,
    checkoutLoading: false
  })

  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    setHeaderDetails({
      title: {
        desktop: `${group?.name || ''} ${t('Store')}`,
        mobile: t('Store')
      },
      icon: 'ShoppingCart'
    })
  }, [group, t])

  /**
   * Loads offerings from the backend
   * 
   * This makes a GraphQL query to fetch offerings from the connected account
   */
  const loadOfferings = useCallback(async () => {
    if (!group?.id || !state.accountId) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: t('Group or account not found')
      }))
      return
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Make GraphQL query to fetch offerings
      const query = `
        query ($groupId: ID!, $accountId: String!) {
          stripeOfferings(
            groupId: $groupId
            accountId: $accountId
          ) {
            offerings {
              id
              name
              description
              defaultPriceId
              images
              active
            }
            success
          }
        }
      `

      const response = await fetch('/noo/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          query,
          variables: {
            groupId: group.id,
            accountId: state.accountId
          }
        })
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0].message)
      }

      const offerings = result.data?.stripeOfferings?.offerings || []

      setState(prev => ({
        ...prev,
        offerings,
        loading: false
      }))
    } catch (error) {
      console.error('Error loading offerings:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }, [group, state.accountId, t])

  useEffect(() => {
    if (state.accountId) {
      loadOfferings()
    }
  }, [state.accountId, loadOfferings])

  /**
   * Initiates a checkout session for an offering
   * 
   * Creates a Stripe Checkout session and redirects the customer
   * to the hosted checkout page.
   */
  const handlePurchase = useCallback(async (offering) => {
    if (!group?.id || !state.accountId) return

    setState(prev => ({ ...prev, checkoutLoading: true }))

    try {
      // Make GraphQL mutation to create checkout session
      const mutation = `
        mutation ($groupId: ID!, $accountId: String!, $priceId: String!, $quantity: Int, $successUrl: String!, $cancelUrl: String!, $metadata: JSON) {
          createStripeCheckoutSession(
            groupId: $groupId
            accountId: $accountId
            priceId: $priceId
            quantity: $quantity
            successUrl: $successUrl
            cancelUrl: $cancelUrl
            metadata: $metadata
          ) {
            sessionId
            url
            success
          }
        }
      `

      const baseUrl = window.location.origin
      const successUrl = `${baseUrl}/groups/${groupSlug}/store/success`
      const cancelUrl = `${baseUrl}/groups/${groupSlug}/store`

      const response = await fetch('/noo/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          query: mutation,
          variables: {
            groupId: group.id,
            accountId: state.accountId,
            priceId: offering.defaultPriceId,
            quantity: 1,
            successUrl,
            cancelUrl,
            metadata: {
              offeringId: offering.id,
              groupSlug: groupSlug
            }
          }
        })
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0].message)
      }

      const checkoutUrl = result.data?.createStripeCheckoutSession?.url

      if (!checkoutUrl) {
        throw new Error(t('No checkout URL returned'))
      }

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert(t('Failed to start checkout: {{error}}', { error: error.message }))
      setState(prev => ({ ...prev, checkoutLoading: false }))
    }
  }, [group, state.accountId, groupSlug, t])

  if (!group) {
    return (
      <div className='max-w-4xl mx-auto p-6'>
        <Loading />
      </div>
    )
  }

  if (!state.accountId) {
    return (
      <div className='max-w-4xl mx-auto p-6'>
        <NoStoreSetup group={group} t={t} />
      </div>
    )
  }

  if (state.loading) {
    return (
      <div className='max-w-4xl mx-auto p-6'>
        <Loading />
      </div>
    )
  }

  if (state.error) {
    return (
      <div className='max-w-4xl mx-auto p-6'>
        <div className='bg-destructive/10 border border-destructive text-destructive p-4 rounded-md'>
          <p className='font-semibold'>{t('Error')}</p>
          <p className='text-sm'>{state.error}</p>
        </div>
      </div>
    )
  }

  if (state.offerings.length === 0) {
    return (
      <div className='max-w-4xl mx-auto p-6'>
        <NoOfferingsAvailable group={group} t={t} />
      </div>
    )
  }

  return (
    <div className='max-w-6xl mx-auto p-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-foreground mb-2'>
          {group.name} {t('Store')}
        </h1>
        <p className='text-foreground/70'>
          {t('Browse and purchase offerings from this group')}
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {state.offerings.map(offering => (
          <OfferingCard
            key={offering.id}
            offering={offering}
            onPurchase={() => handlePurchase(offering)}
            loading={state.checkoutLoading}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Displayed when the group hasn't set up payments yet
 */
function NoStoreSetup ({ group, t }) {
  return (
    <div className='bg-card p-8 rounded-lg text-center shadow-xl'>
      <ShoppingCart className='w-16 h-16 mx-auto mb-4 text-foreground/50' />
      <h2 className='text-2xl font-bold mb-2'>{t('Store Not Available')}</h2>
      <p className='text-foreground/70 mb-4'>
        {t('This group hasn\'t set up their store yet.')}
      </p>
      <p className='text-sm text-foreground/70'>
        {t('Group administrators can set up payments in group settings.')}
      </p>
    </div>
  )
}

/**
 * Displayed when there are no offerings available
 */
function NoOfferingsAvailable ({ group, t }) {
  return (
    <div className='bg-card p-8 rounded-lg text-center shadow-xl'>
      <CreditCard className='w-16 h-16 mx-auto mb-4 text-foreground/50' />
      <h2 className='text-2xl font-bold mb-2'>{t('No Offerings Available')}</h2>
      <p className='text-foreground/70 mb-4'>
        {t('This group doesn\'t have any offerings for sale yet.')}
      </p>
      <p className='text-sm text-foreground/70'>
        {t('Check back later for new offerings.')}
      </p>
    </div>
  )
}

/**
 * Card displaying a single offering
 */
function OfferingCard ({ offering, onPurchase, loading, t }) {
  return (
    <div className='bg-card rounded-lg shadow-lg overflow-hidden flex flex-col h-full'>
      {/* Offering Image */}
      {offering.images && offering.images.length > 0 ? (
        <div className='aspect-video bg-gradient-to-br from-primary/20 to-primary/10'>
          <img
            src={offering.images[0]}
            alt={offering.name}
            className='w-full h-full object-cover'
          />
        </div>
      ) : (
        <div className='aspect-video bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center'>
          <CreditCard className='w-12 h-12 text-primary/50' />
        </div>
      )}

      {/* Offering Info */}
      <div className='p-6 flex-1 flex flex-col'>
        <h3 className='text-xl font-semibold text-foreground mb-2'>
          {offering.name}
        </h3>
        
        {offering.description && (
          <p className='text-foreground/70 text-sm mb-4 flex-1'>
            {offering.description}
          </p>
        )}

        {/* Purchase Button */}
        <Button
          onClick={onPurchase}
          disabled={loading || !offering.active}
          className='w-full'
        >
          {!offering.active ? (
            t('Not Available')
          ) : loading ? (
            t('Loading...')
          ) : (
            <>
              <ShoppingCart className='w-4 h-4 mr-2' />
              {t('Purchase')}
            </>
          )}
        </Button>

        <p className='text-xs text-foreground/50 mt-2 text-center'>
          {t('Powered by Stripe')}
        </p>
      </div>
    </div>
  )
}

/**
 * Success page after checkout
 * 
 * Displayed when customer returns from successful payment
 */
export function GroupStoreSuccess () {
  const { t } = useTranslation()
  const { groupSlug } = useParams()

  return (
    <div className='max-w-2xl mx-auto p-6'>
      <div className='bg-card p-8 rounded-lg text-center shadow-xl'>
        <CheckCircle className='w-16 h-16 mx-auto mb-4 text-green-500' />
        <h2 className='text-2xl font-bold mb-2'>{t('Payment Successful!')}</h2>
        <p className='text-foreground/70 mb-6'>
          {t('Thank you for your purchase. You should receive a confirmation email shortly.')}
        </p>
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Button
            onClick={() => window.location.href = `/groups/${groupSlug}`}
          >
            {t('Return to Group')}
          </Button>
          <Button
            variant='outline'
            onClick={() => window.location.href = `/groups/${groupSlug}/store`}
          >
            {t('Continue Shopping')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default GroupStore

