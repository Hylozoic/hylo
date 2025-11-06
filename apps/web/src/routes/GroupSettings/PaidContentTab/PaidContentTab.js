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
import { CreditCard, CheckCircle, AlertCircle, ExternalLink, PlusCircle, Edit } from 'lucide-react'

import Button from 'components/ui/button'
import Loading from 'components/Loading'
import SettingsControl from 'components/SettingsControl'
import SettingsSection from '../SettingsSection'
import { useViewHeader } from 'contexts/ViewHeaderContext'

import {
  createConnectedAccount,
  createAccountLink,
  fetchAccountStatus,
  checkStripeStatus,
  createOffering,
  fetchOfferings
  // updateOffering - TODO: Enable when database offering IDs are available
} from './PaidContentTab.store'
import { fetchGroupSettings } from '../GroupSettings.store'
import { getHost } from 'store/middleware/apiMiddleware'

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
  }, [dispatch, group, state.accountId])

  /**
   * Generates an Account Link and redirects the user to Stripe
   *
   * The user will complete onboarding on Stripe's hosted pages,
   * then return to the returnUrl when complete.
   */
  const handleStartOnboarding = useCallback(async (accountIdToUse) => {
    if (!group) return

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
  }, [dispatch, group, state.accountId])

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
  }, [dispatch, group, handleStartOnboarding, loadAccountStatus])

  /**
   * Loads all offerings for this connected account
   */
  const loadOfferings = useCallback(async () => {
    if (!group?.id || !state.accountId) return

    try {
      const result = await dispatch(fetchOfferings(group.id, state.accountId))

      if (result.error) {
        throw new Error(result.error.message)
      }

      const offerings = result.payload?.data?.stripeOfferings?.offerings || []

      setState(prev => ({
        ...prev,
        offerings
      }))
    } catch (error) {
      console.error('Error loading offerings:', error)
    }
  }, [dispatch, group, state.accountId])

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
    if (!group) return

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
  }, [dispatch, group, loadAccountStatus])

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
          {t('Account')}
        </Link>
        <Link
          className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'offerings' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
          to='offerings'
        >
          {t('Offerings')}
        </Link>
        <Link
          className={`py-1 px-4 rounded-md border-2 !text-foreground border-foreground/20 hover:text-foreground hover:border-foreground transition-all ${currentTab === 'content-access' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
          to='content-access'
        >
          {t('Content Access')}
        </Link>
      </div>

      <h2 className='text-foreground font-bold mb-2'>{t('Accept payments for your group')}</h2>
      <p className='text-foreground/70 mb-4'>
        {t('Set up Stripe Connect to accept payments for group memberships, track content, and other offerings. Stripe handles all payment processing securely.')}
      </p>

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
          <Route path='content-access' element={<ContentAccessTab group={group} />} />
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
              />
            }
          />
        </Routes>
      </div>
    </div>
  )
}

/**
 * Account Tab Component
 *
 * Main tab showing account setup and status
 */
function AccountTab ({ group, currentUser, accountId, loading, onCreateAccount, onCheckStatus, onStartOnboarding }) {
  const { t } = useTranslation()

  return (
    <>
      {!accountId
        ? (
          <AccountSetupSection
            loading={loading}
            onCreateAccount={onCreateAccount}
            group={group}
            currentUser={currentUser}
            t={t}
          />)
        : (
          <StripeStatusSection
            group={group}
            loading={loading}
            onCheckStatus={onCheckStatus}
            onStartOnboarding={onStartOnboarding}
            t={t}
          />)}
    </>
  )
}

/**
 * Offerings Tab Component
 *
 * Displays a list of offerings with details and management options
 */
function OfferingsTab ({ group, accountId, offerings, onRefreshOfferings }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingOffering, setEditingOffering] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'usd'
  })
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)

  const handleCreateOffering = useCallback(async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.price) {
      alert(t('Please fill in all required fields'))
      return
    }

    setCreating(true)

    try {
      const priceInCents = Math.round(parseFloat(formData.price) * 100)

      if (isNaN(priceInCents) || priceInCents < 0) {
        throw new Error(t('Invalid price'))
      }

      const result = await dispatch(createOffering(
        group.id,
        accountId,
        formData.name,
        formData.description,
        priceInCents,
        formData.currency
      ))

      if (result.error) {
        throw new Error(result.error.message)
      }

      // Reset form and refresh offerings
      setFormData({ name: '', description: '', price: '', currency: 'usd' })
      setShowCreateForm(false)
      onRefreshOfferings()
    } catch (error) {
      console.error('Error creating offering:', error)
      alert(t('Failed to create offering: {{error}}', { error: error.message }))
    } finally {
      setCreating(false)
    }
  }, [dispatch, group, accountId, formData, onRefreshOfferings, t])

  const handleUpdateOffering = useCallback(async (e) => {
    e.preventDefault()

    if (!editingOffering || !formData.name) {
      alert(t('Please fill in all required fields'))
      return
    }

    setUpdating(true)

    try {
      const updates = {}
      if (formData.name !== editingOffering.name) updates.name = formData.name
      if (formData.description !== editingOffering.description) updates.description = formData.description

      if (Object.keys(updates).length === 0) {
        setEditingOffering(null)
        setUpdating(false)
        return
      }

      alert(t('Offering updates require database offering IDs. This feature is coming soon.'))

      setEditingOffering(null)
      setFormData({ name: '', description: '', price: '', currency: 'usd' })
      onRefreshOfferings()
    } catch (error) {
      console.error('Error updating offering:', error)
      alert(t('Failed to update offering: {{error}}', { error: error.message }))
    } finally {
      setUpdating(false)
    }
  }, [dispatch, editingOffering, formData, onRefreshOfferings, t])

  const handleStartEdit = useCallback((offering) => {
    setEditingOffering(offering)
    setFormData({
      name: offering.name || '',
      description: offering.description || '',
      price: '',
      currency: 'usd'
    })
    setShowCreateForm(false)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingOffering(null)
    setFormData({ name: '', description: '', price: '', currency: 'usd' })
    setShowCreateForm(false)
  }, [])

  return (
    <div className='flex flex-col gap-4 mt-4 pb-4'>
      <button
        className='w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md flex flex-row items-center gap-2 justify-center'
        onClick={() => setShowCreateForm(true)}
      >
        <PlusCircle className='w-4 h-4' />
        <span>{t('Create Offering')}</span>
      </button>

      {showCreateForm && (
        <div className='border-2 border-foreground/20 rounded-lg p-4'>
          <h3 className='text-lg font-semibold mb-3'>{t('Create New Offering')}</h3>
          <form onSubmit={handleCreateOffering} className='space-y-3'>
            <SettingsControl
              label={t('Offering Name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('e.g., Premium Membership')}
              required
            />
            <SettingsControl
              label={t('Description')}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('What does this offering include?')}
            />
            <div className='flex gap-3'>
              <div className='flex-1'>
                <SettingsControl
                  label={t('Price')}
                  type='number'
                  step='0.01'
                  min='0'
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder='20.00'
                  required
                />
              </div>
              <div className='w-24'>
                <SettingsControl
                  label={t('Currency')}
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  renderControl={(props) => (
                    <select {...props} className='w-full p-2 rounded-md bg-background border border-border'>
                      <option value='usd'>USD</option>
                      <option value='eur'>EUR</option>
                      <option value='gbp'>GBP</option>
                      <option value='cad'>CAD</option>
                    </select>
                  )}
                />
              </div>
            </div>
            <div className='flex gap-2 justify-end pt-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setShowCreateForm(false)
                  setFormData({ name: '', description: '', price: '', currency: 'usd' })
                }}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='submit'
                disabled={creating}
              >
                {creating ? t('Creating...') : t('Create Offering')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {editingOffering && (
        <div className='border-2 border-foreground/20 rounded-lg p-4'>
          <h3 className='text-lg font-semibold mb-3'>{t('Edit Offering')}</h3>
          <form onSubmit={handleUpdateOffering} className='space-y-3'>
            <SettingsControl
              label={t('Offering Name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('e.g., Premium Membership')}
              required
            />
            <SettingsControl
              label={t('Description')}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('What does this offering include?')}
            />
            <div className='flex gap-2 justify-end pt-2'>
              <Button
                type='button'
                variant='outline'
                onClick={handleCancelEdit}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='submit'
                disabled={updating}
              >
                {updating ? t('Updating...') : t('Update Offering')}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className='border-2 border-foreground/20 rounded-lg p-4'>
        <h3 className='text-sm opacity-50 w-full text-center mb-3'>{t('Offerings')}</h3>
        <div className='flex flex-col gap-3'>
          {offerings.length === 0
            ? (
              <div className='text-center py-8 text-foreground/70'>
                <CreditCard className='w-12 h-12 mx-auto mb-2 opacity-50' />
                <p>{t('No offerings yet')}</p>
                <p className='text-sm'>{t('Create your first offering to start accepting payments')}</p>
              </div>
              )
            : (
                offerings.map(offering => (
                  <OfferingListItem
                    key={offering.id}
                    offering={offering}
                    onEdit={handleStartEdit}
                    t={t}
                  />
                ))
              )}
        </div>
      </div>
    </div>
  )
}

/**
 * Content Access Tab Component
 *
 * Placeholder component for managing content access
 */
function ContentAccessTab ({ group }) {
  const { t } = useTranslation()

  return (
    <SettingsSection>
      <div className='bg-card p-6 rounded-md text-foreground shadow-xl'>
        <h3 className='text-lg font-semibold mb-2'>{t('Content Access')}</h3>
        <p className='text-sm text-foreground/70'>
          {t('Manage content access settings for your group offerings.')}
        </p>
      </div>
    </SettingsSection>
  )
}

/**
 * Section for initial account setup
 *
 * Displayed when the group doesn't have a Stripe account yet.
 * Provides a form to collect account information for creating a new Stripe account.
 * Note: If the user already has a Stripe account, Stripe will prompt them to connect it during onboarding.
 */
function AccountSetupSection ({ loading, onCreateAccount, group, currentUser, t }) {
  const [formData, setFormData] = useState({
    email: currentUser?.email || '',
    businessName: group?.name || '',
    country: 'US'
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.email.trim()) {
      alert(t('Email is required'))
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      alert(t('Please enter a valid email address'))
      return
    }

    setSubmitting(true)
    try {
      await onCreateAccount({
        email: formData.email.trim(),
        businessName: formData.businessName.trim() || group.name,
        country: formData.country
      })
    } catch (error) {
      console.error('Error creating account:', error)
      // Error state is handled by parent component
    } finally {
      setSubmitting(false)
    }
  }, [formData, onCreateAccount, group, t])

  return (
    <>
      <div className='mb-4'>
        <h3 className='text-lg font-semibold mb-2'>{t('Get started with payments')}</h3>
        <p className='text-sm text-foreground/70 mb-4'>
          {t('Set up Stripe Connect to accept payments. If you already have a Stripe account, Stripe will prompt you to connect it during onboarding.')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <SettingsControl
          label={t('Email')}
          type='email'
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder={currentUser?.email || t('your-email@example.com')}
          required
          helpText={t('This email will be associated with your Stripe account')}
        />

        <SettingsControl
          label={t('Business Name')}
          value={formData.businessName}
          onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
          placeholder={group?.name || t('Business or Organization Name')}
          helpText={t('The name of your business or organization (defaults to group name)')}
        />

        <div className='flex gap-3'>
          <div className='flex-1'>
            <SettingsControl
              label={t('Country')}
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              renderControl={(props) => (
                <select {...props} className='w-full p-2 rounded-md bg-background border border-border text-foreground'>
                  <option value='US'>{t('United States')}</option>
                  <option value='CA'>{t('Canada')}</option>
                  <option value='GB'>{t('United Kingdom')}</option>
                  <option value='AU'>{t('Australia')}</option>
                  <option value='IE'>{t('Ireland')}</option>
                  <option value='NZ'>{t('New Zealand')}</option>
                  <option value='DE'>{t('Germany')}</option>
                  <option value='FR'>{t('France')}</option>
                  <option value='ES'>{t('Spain')}</option>
                  <option value='NL'>{t('Netherlands')}</option>
                </select>
              )}
              helpText={t('Country where your business is located')}
            />
          </div>
        </div>

        <div className='flex gap-2 justify-end pt-4'>
          <Button
            type='submit'
            disabled={loading || submitting}
            className='w-full sm:w-auto'
          >
            {submitting ? t('Creating...') : t('Create Account')}
          </Button>
        </div>
      </form>

      <div className='mt-4 p-3 bg-background/50 rounded-md text-sm text-foreground/70'>
        <p className='font-semibold mb-2'>{t('About Stripe Connect:')}</p>
        <ul className='space-y-1 list-disc list-inside'>
          <li>{t('Accept credit card and other payment methods')}</li>
          <li>{t('Automatic payouts to your bank account')}</li>
          <li>{t('Full dashboard access to view transactions')}</li>
          <li>{t('Stripe handles all payment disputes and fraud')}</li>
        </ul>
      </div>
    </>
  )
}

/**
 * Section showing Stripe account status from database
 *
 * Displays the current state of the connected account based on database values,
 * and provides actions to check status with Stripe or complete onboarding.
 */
function StripeStatusSection ({ group, loading, onCheckStatus, onStartOnboarding, t }) {
  const chargesEnabled = group?.stripeChargesEnabled
  const payoutsEnabled = group?.stripePayoutsEnabled
  const detailsSubmitted = group?.stripeDetailsSubmitted
  const paywall = group?.paywall
  const isFullyOnboarded = chargesEnabled && payoutsEnabled
  const needsOnboarding = !detailsSubmitted

  return (
    <div className='bg-card p-6 rounded-md text-foreground shadow-xl mb-4'>
      <div className='flex items-start justify-between mb-4'>
        <div className='flex items-start gap-3'>
          {isFullyOnboarded
            ? (<CheckCircle className='w-8 h-8 text-green-500 flex-shrink-0' />)
            : (<AlertCircle className='w-8 h-8 text-amber-500 flex-shrink-0' />)}
          <div>
            <h3 className='text-lg font-semibold mb-1'>
              {isFullyOnboarded ? t('Account Active') : t('Account Setup Required')}
            </h3>
            <p className='text-sm text-foreground/70'>
              {isFullyOnboarded
                ? t('Your Stripe account is fully set up and ready to accept payments.')
                : t('Complete your account setup to start accepting payments.')}
            </p>
          </div>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={onCheckStatus}
          disabled={loading}
        >
          {loading ? t('Checking...') : t('Check Stripe Status')}
        </Button>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4'>
        <StatusBadge
          label={t('Accept Payments')}
          value={chargesEnabled}
          t={t}
        />
        <StatusBadge
          label={t('Receive Payouts')}
          value={payoutsEnabled}
          t={t}
        />
        <StatusBadge
          label={t('Details Submitted')}
          value={detailsSubmitted}
          t={t}
        />
      </div>

      {group?.stripeDashboardUrl && (
        <div className='mb-4'>
          <a
            href={group.stripeDashboardUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-background'
          >
            <ExternalLink className='w-4 h-4' />
            {t('Open Stripe Dashboard')}
          </a>
        </div>
      )}

      <div className='mb-4'>
        <SettingsControl
          label={t('Paywall Enabled')}
          helpText={t('When enabled, users must purchase access to join this group')}
          renderControl={() => (
            <div className='flex items-center gap-2'>
              <input
                type='checkbox'
                checked={paywall || false}
                disabled
                className='w-4 h-4'
              />
              <span className='text-sm text-foreground/70'>
                {paywall ? t('Yes') : t('No')}
              </span>
            </div>
          )}
        />
      </div>

      {needsOnboarding && (
        <Button
          onClick={() => onStartOnboarding()}
          className='w-full sm:w-auto'
        >
          <ExternalLink className='w-4 h-4 mr-2' />
          {t('Complete Onboarding')}
        </Button>
      )}
    </div>
  )
}

/**
 * Badge showing a single status indicator
 */
function StatusBadge ({ label, value, t }) {
  return (
    <div className='flex items-center gap-2 p-3 bg-background rounded-md'>
      <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-gray-400'}`} />
      <div>
        <p className='text-xs text-foreground/70'>{label}</p>
        <p className='text-sm font-medium'>{value ? t('Yes') : t('No')}</p>
      </div>
    </div>
  )
}

/**
 * List item displaying a single offering with details
 * Used in the OfferingsTab list view
 */
function OfferingListItem ({ offering, onEdit, t }) {
  return (
    <div className='border-2 border-foreground/20 rounded-lg p-4 hover:border-foreground/40 transition-all'>
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <div className='flex items-center gap-2 mb-2'>
            <h4 className='font-semibold text-foreground'>{offering.name}</h4>
            {offering.active
              ? (<span className='text-xs bg-green-500/20 text-green-600 font-medium px-2 py-0.5 rounded-full'>{t('Active')}</span>)
              : (<span className='text-xs bg-gray-500/20 text-gray-600 px-2 py-0.5 rounded-full'>{t('Inactive')}</span>)}
          </div>
          {offering.description && (
            <p className='text-sm text-foreground/70 mb-2'>{offering.description}</p>
          )}
          <div className='flex items-center gap-4 text-xs text-foreground/50'>
            <span>{t('Stripe ID')}: {offering.id}</span>
            {offering.defaultPriceId && (
              <span>{t('Price ID')}: {offering.defaultPriceId}</span>
            )}
          </div>
        </div>
        {onEdit && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => onEdit(offering)}
            className='ml-4'
          >
            <Edit className='w-4 h-4 mr-1' />
            {t('Edit')}
          </Button>
        )}
      </div>
    </div>
  )
}

export default PaidContentTab
