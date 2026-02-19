/**
 * PaidContentTab Component
 *
 * Manages Stripe Connect integration for groups.
 * Allows group administrators to:
 * - Onboard their group to Stripe Connect
 * - Create products for group membership subscriptions
 * - Define charges for track content
 * - View onboarding status
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link, Routes, Route, useLocation } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import isMobile from 'ismobilejs'

import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'

import {
  createConnectedAccount,
  createAccountLink,
  fetchAccountStatus,
  checkStripeStatus,
  fetchOfferings
} from './PaidContentTab.store'
import { fetchGroupSettings } from '../GroupSettings.store'
import { getHost } from 'store/middleware/apiMiddleware'

import AccountTab from './AccountTab'
import OfferingsTab from './OfferingsTab'
import ContentAccessTab from './ContentAccessTab'

/**
 * Main PaidContentTab component
 * Orchestrates the Stripe Connect integration UI
 */
function PaidContentTab ({ group, currentUser }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()

  // Local state for managing Stripe account and products
  // Note: accountId comes from camelCase GraphQL field
  const initialAccountId = group?.stripeAccountId || ''
  const [state, setState] = useState({
    accountId: initialAccountId,
    accountStatus: null,
    offerings: [],
    loading: false,
    error: null
  })

  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    setHeaderDetails({
      title: {
        desktop: `${t('Group Settings')} > ${t('Paid Content')}`,
        mobile: `${t('Paid Content')}`
      },
      icon: 'CreditCard'
    })
  }, [])

  // Update accountId when group changes
  useEffect(() => {
    const newAccountId = group?.stripeAccountId || ''
    if (newAccountId && newAccountId !== state.accountId) {
      setState(prev => ({ ...prev, accountId: newAccountId }))
    }
  }, [group?.stripeAccountId])

  /**
   * Loads the current account status from Stripe
   *
   * This fetches the live status to show onboarding progress
   * and payment capabilities.
   */
  const loadAccountStatus = useCallback(async () => {
    if (!group?.id || !state.accountId) return

    try {
      const result = await dispatch(fetchAccountStatus(group.id, state.accountId))

      if (result.error) {
        throw new Error(result.error.message)
      }

      const status = result.payload?.data?.stripeAccountStatus

      setState(prev => ({
        ...prev,
        accountStatus: status
      }))
    } catch (error) {
      console.error('Error loading account status:', error)
      setState(prev => ({
        ...prev,
        error: error.message
      }))
    }
  }, [dispatch, group?.id, state.accountId])

  /**
   * Generates an Account Link and redirects the user to Stripe
   *
   * The user will complete onboarding on Stripe's hosted pages,
   * then return to the returnUrl when complete.
   */
  const handleStartOnboarding = useCallback(async (accountIdToUse) => {
    if (!group?.id) return

    const accountId = accountIdToUse || state.accountId
    if (!accountId) {
      setState(prev => ({ ...prev, error: 'No account ID available' }))
      return
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Build return URLs
      const baseUrl = getHost()
      const returnUrl = `${baseUrl}/groups/${group.slug}/settings/paid-content?onboarding=complete`
      const refreshUrl = `${baseUrl}/groups/${group.slug}/settings/paid-content?onboarding=refresh`

      const result = await dispatch(createAccountLink(
        group.id,
        accountId,
        returnUrl,
        refreshUrl
      ))

      if (result.error) {
        throw new Error(result.error.message || 'Failed to create account link')
      }

      const url = result.payload?.data?.createStripeAccountLink?.url

      if (!url) {
        throw new Error('No onboarding URL returned from server')
      }

      // Redirect to Stripe for onboarding
      window.location.href = url
    } catch (error) {
      console.error('Error creating account link:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }, [dispatch, group?.id, group?.slug, state.accountId])

  /**
   * Creates a new Stripe Connected Account for this group
   *
   * This is the first step in enabling payments. Once the account is created,
   * the group admin needs to complete onboarding via an Account Link.
   * Note: Stripe will handle the case where the user already has an account
   * by prompting them during onboarding.
   */
  const handleCreateAccount = useCallback(async ({ email, businessName, country }) => {
    if (!group) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await dispatch(createConnectedAccount(
        group.id,
        email,
        businessName || group.name,
        country || 'US'
      ))

      // Check for errors in the response
      if (result.error || result.payload?.errors) {
        const error = result.error || result.payload?.errors?.[0]
        throw new Error(error?.message || 'Failed to create connected account')
      }

      // Access data - getData() is at result.payload.getData
      const responseData = result.payload?.getData
        ? result.payload.getData()
        : result.payload?.data?.createStripeConnectedAccount

      // If the mutation returned null, log full details
      if (!responseData || responseData === null) {
        console.error('Mutation returned null. Full response:', {
          payload: result.payload,
          payloadData: result.payload?.data,
          getDataResult: result.payload?.getData ? result.payload.getData() : null,
          errors: result.payload?.errors
        })
        throw new Error('The server returned null. This usually means the mutation failed. Check the browser console and server logs for details.')
      }

      const accountId = responseData.accountId

      if (!accountId) {
        throw new Error('Server response missing accountId field: ' + JSON.stringify(responseData))
      }

      // Refresh group data to get the updated stripe_account_id
      if (group?.slug) {
        await dispatch(fetchGroupSettings(group.slug))
      }

      // Update local state with the external account ID for display purposes
      setState(prev => ({
        ...prev,
        accountId,
        loading: false
      }))

      // Automatically trigger onboarding after account creation
      handleStartOnboarding(accountId)
    } catch (error) {
      console.error('Error creating/connecting account:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }, [dispatch, group?.id, group?.slug, group?.name, handleStartOnboarding])

  /**
   * Loads all offerings for this connected account
   */
  const loadOfferings = useCallback(async () => {
    if (!group?.id || !state.accountId) return

    try {
      const result = await dispatch(fetchOfferings(group.id, state.accountId))

      if (result.error) {
        console.error('Error in fetchOfferings:', result.error)
        throw new Error(result.error.message)
      }

      // Use getData() helper from graphqlMiddleware to get the root query result
      const responseData = result.payload?.getData
        ? result.payload.getData()
        : result.payload?.data?.stripeOfferings

      if (!responseData) {
        console.error('No response data from stripeOfferings query. Full result:', {
          payload: result.payload,
          payloadData: result.payload?.data,
          getDataResult: result.payload?.getData ? result.payload.getData() : null,
          errors: result.payload?.errors
        })
      }

      const offerings = responseData?.offerings || []

      setState(prev => ({
        ...prev,
        offerings
      }))
    } catch (error) {
      console.error('Error loading offerings:', error)
    }
  }, [dispatch, group?.id, state.accountId])

  // Load account status if we have an account ID
  useEffect(() => {
    if (state.accountId && group?.id) {
      loadAccountStatus()
      loadOfferings()
    }
  }, [state.accountId, group?.id, loadAccountStatus, loadOfferings])

  /**
   * Checks Stripe status and updates the database
   */
  const handleCheckStripeStatus = useCallback(async () => {
    if (!group?.id) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await dispatch(checkStripeStatus(group.id))

      if (result.error || result.payload?.errors) {
        const error = result.error || result.payload?.errors?.[0]
        throw new Error(error?.message || 'Failed to check Stripe status')
      }

      const responseData = result.payload?.getData
        ? result.payload.getData()
        : result.payload?.data?.checkStripeStatus

      if (!responseData || !responseData.success) {
        throw new Error(responseData?.message || 'Failed to check Stripe status')
      }

      // Refresh the group data to get updated stripe status values from the DB
      if (group?.slug) {
        await dispatch(fetchGroupSettings(group.slug))
      }

      setState(prev => ({ ...prev, loading: false, error: null }))

      // Reload live account status to reflect the updates
      loadAccountStatus()
    } catch (error) {
      console.error('Error checking Stripe status:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }, [dispatch, group?.id, group?.slug, loadAccountStatus])

  // Check for onboarding completion query parameter and trigger status check
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const onboarding = searchParams.get('onboarding')

    if (onboarding === 'complete' && group?.id && state.accountId) {
      // Automatically check Stripe status when user returns from onboarding
      handleCheckStripeStatus()
    }
  }, [location.search, group?.id, state.accountId, handleCheckStripeStatus])

  // Extract nested tab from pathname
  // URL structure: /groups/:groupSlug/settings/paid-content/:subTab
  const pathParts = location.pathname.split('/')
  const paidContentIndex = pathParts.indexOf('paid-content')
  const subTab = paidContentIndex > -1 && pathParts[paidContentIndex + 1] ? pathParts[paidContentIndex + 1] : null
  const currentTab = subTab || 'account'

  if (!group) return <Loading />

  const { accountId, offerings, loading, error } = state

  return (
    <div className='mb-[300px]'>
      <div className='flex gap-2 w-full justify-center items-center bg-black/10 rounded-md p-2 mb-4'>
        <Link
          className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'account' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
          to=''
        >
          {!isMobile.any ? t('Payments Account') : t('Account')}
        </Link>
        <Link
          className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'offerings' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
          to='offerings'
        >
          {!isMobile.any ? t('Paid Offerings') : t('Offerings')}
        </Link>
        <Link
          className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'content-access' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
          to='content-access'
        >
          {!isMobile.any ? t('Paid Content Access') : t('Content Access')}
        </Link>
      </div>

      <h2 className='text-foreground font-bold mb-2'>{t('Accept Payments for {{groupName}}', { groupName: group?.name || '' })}</h2>
      <div className='text-foreground/70 mb-4 space-y-2'>
        {currentTab === 'account' && (
          <>
            <p>{t('Use Paid Content to create offerings that members can access through payment.')}</p>
            <p>{t('To start, set up Stripe Connect to accept payments for group memberships, Tracks, and other offerings. Stripe handles all payment processing securely.')}</p>
          </>
        )}
        {currentTab === 'offerings' && (
          <p>{t('An Offering is something your group provides in exchange for payment, like a membership, Track, or Role in the group.')}</p>
        )}
        {currentTab === 'content-access' && (
          <p>{t('Paid Content Access shows who has access to paid content in your group and lets you manage those permissions.')}</p>
        )}
      </div>

      {error && (
        <div className='bg-destructive/10 border border-destructive text-destructive p-4 rounded-md mb-4 flex items-start gap-2'>
          <AlertCircle className='w-5 h-5 flex-shrink-0 mt-0.5' />
          <div>
            <p className='font-semibold'>{t('Error')}</p>
            <p className='text-sm'>{error}</p>
          </div>
        </div>
      )}

      <div className='flex-1'>
        <Routes>
          <Route path='offerings' element={<OfferingsTab group={group} accountId={accountId} offerings={offerings} onRefreshOfferings={loadOfferings} />} />
          <Route path='content-access' element={<ContentAccessTab group={group} offerings={offerings} />} />
          <Route
            path='*'
            element={
              <AccountTab
                group={group}
                currentUser={currentUser}
                accountId={accountId}
                loading={loading}
                onCreateAccount={handleCreateAccount}
                onCheckStatus={handleCheckStripeStatus}
                onStartOnboarding={handleStartOnboarding}
                t={t}
              />
            }
          />
        </Routes>
      </div>
    </div>
  )
}

export default PaidContentTab
