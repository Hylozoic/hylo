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
import { CreditCard, CheckCircle, AlertCircle, ExternalLink, PlusCircle } from 'lucide-react'

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
  createProduct,
  fetchProducts
  // updateProduct - TODO: Enable when database product IDs are available
} from './PaidContentTab.store'
import { updateGroupSettings, fetchGroupSettings } from '../GroupSettings.store'

/**
 * Main PaidContentTab component
 * Orchestrates the Stripe Connect integration UI
 */
function PaidContentTab ({ group, currentUser }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  // Local state for managing Stripe account and products
  // Note: accountId comes from camelCase GraphQL field
  const initialAccountId = group?.stripeAccountId || ''
  const [state, setState] = useState({
    accountId: initialAccountId,
    accountStatus: null,
    products: [],
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
      // TODO STRIPE: Replace with your actual domain
      const baseUrl = window.location.origin
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
   */
  const handleCreateAccount = useCallback(async ({ email, businessName, country, existingAccountId }) => {
    if (!group) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await dispatch(createConnectedAccount(
        group.id,
        email,
        businessName || group.name,
        country || 'US',
        existingAccountId || null
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

      // Save accountId to your group model in the database
      await dispatch(updateGroupSettings(group.id, { stripeAccountId: accountId }))

      setState(prev => ({
        ...prev,
        accountId,
        loading: false
      }))

      // Automatically trigger onboarding after account creation (only for new accounts)
      if (!existingAccountId) {
        handleStartOnboarding(accountId)
      } else {
        // For existing accounts, just refresh status
        loadAccountStatus()
      }
    } catch (error) {
      console.error('Error creating/connecting account:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }, [dispatch, group, handleStartOnboarding, loadAccountStatus])

  // Load account status if we have an account ID
  useEffect(() => {
    if (state.accountId && group?.id) {
      loadAccountStatus()
      loadProducts()
    }
  }, [state.accountId, group?.id])

  /**
   * Loads all products for this connected account
   */
  const loadProducts = useCallback(async () => {
    if (!group?.id || !state.accountId) return

    try {
      const result = await dispatch(fetchProducts(group.id, state.accountId))

      if (result.error) {
        throw new Error(result.error.message)
      }

      const products = result.payload?.data?.stripeProducts?.products || []

      setState(prev => ({
        ...prev,
        products
      }))
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }, [dispatch, group, state.accountId])

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

  if (!group) return <Loading />

  const { accountId, products, loading, error } = state

  return (
    <div className='mb-[300px]'>
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

      <SettingsSection>
        {!accountId
          ? (
            <AccountSetupSection
              loading={loading}
              onCreateAccount={handleCreateAccount}
              onConnectAccount={handleCreateAccount}
              group={group}
              currentUser={currentUser}
              t={t}
            />)
          : (
            <>
              <StripeStatusSection
                group={group}
                loading={loading}
                onCheckStatus={handleCheckStripeStatus}
                onStartOnboarding={handleStartOnboarding}
                t={t}
              />

              <ProductManagementSection
                group={group}
                accountId={accountId}
                products={products}
                onRefreshProducts={loadProducts}
                t={t}
              />
            </>)}
      </SettingsSection>
    </div>
  )
}

/**
 * Section for initial account setup
 *
 * Displayed when the group doesn't have a Stripe account yet.
 * Provides a form to collect account information for creating or connecting accounts.
 */
function AccountSetupSection ({ loading, onCreateAccount, onConnectAccount, group, currentUser, t }) {
  const [formData, setFormData] = useState({
    email: currentUser?.email || '',
    businessName: group?.name || '',
    country: 'US',
    existingAccountId: ''
  })
  const [isConnectingExisting, setIsConnectingExisting] = useState(false)
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

    // If connecting existing account, validate account ID
    if (isConnectingExisting) {
      if (!formData.existingAccountId.trim()) {
        alert(t('Please enter a Stripe account ID'))
        return
      }
      if (!formData.existingAccountId.startsWith('acct_')) {
        alert(t('Stripe account IDs must start with "acct_"'))
        return
      }
    }

    setSubmitting(true)
    try {
      await (isConnectingExisting ? onConnectAccount : onCreateAccount)({
        email: formData.email.trim(),
        businessName: formData.businessName.trim() || group.name,
        country: formData.country,
        existingAccountId: isConnectingExisting ? formData.existingAccountId.trim() : null
      })
    } catch (error) {
      console.error('Error creating/connecting account:', error)
      // Error state is handled by parent component
    } finally {
      setSubmitting(false)
    }
  }, [formData, isConnectingExisting, onCreateAccount, onConnectAccount, group, t])

  return (
    <SettingsSection>
      <div className='mb-4'>
        <h3 className='text-lg font-semibold mb-2'>{t('Get started with payments')}</h3>
        <p className='text-sm text-foreground/70 mb-4'>
          {t('Set up Stripe Connect to accept payments. You can create a new account or connect an existing Stripe account.')}
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

        <div className='flex items-center gap-2 mb-4'>
          <input
            type='checkbox'
            id='connectExisting'
            checked={isConnectingExisting}
            onChange={(e) => setIsConnectingExisting(e.target.checked)}
            className='w-4 h-4'
          />
          <label htmlFor='connectExisting' className='text-sm text-foreground/70 cursor-pointer'>
            {t('Connect an existing Stripe account instead')}
          </label>
        </div>

        {isConnectingExisting && (
          <SettingsControl
            label={t('Stripe Account ID')}
            value={formData.existingAccountId}
            onChange={(e) => setFormData(prev => ({ ...prev, existingAccountId: e.target.value }))}
            placeholder='acct_...'
            required={isConnectingExisting}
            helpText={t('Enter your existing Stripe Connect account ID (starts with "acct_")')}
          />
        )}

        <div className='flex gap-2 justify-end pt-4'>
          <Button
            type='submit'
            disabled={loading || submitting}
            className='w-full sm:w-auto'
          >
            {submitting
              ? (isConnectingExisting ? t('Connecting...') : t('Creating...'))
              : (isConnectingExisting ? t('Connect Account') : t('Create Account'))}
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
    </SettingsSection>
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
 * Section for managing products
 *
 * Allows creating and viewing products that customers can purchase.
 */
function ProductManagementSection ({ group, accountId, products, onRefreshProducts, t }) {
  const dispatch = useDispatch()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'usd'
  })
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)

  /**
   * Handles product creation
   */
  const handleCreateProduct = useCallback(async (e) => {
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

      const result = await dispatch(createProduct(
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

      // Reset form and refresh products
      setFormData({ name: '', description: '', price: '', currency: 'usd' })
      setShowCreateForm(false)
      onRefreshProducts()
    } catch (error) {
      console.error('Error creating product:', error)
      alert(t('Failed to create product: {{error}}', { error: error.message }))
    } finally {
      setCreating(false)
    }
  }, [dispatch, group, accountId, formData, onRefreshProducts, t])

  /**
   * Handles product updates
   */
  const handleUpdateProduct = useCallback(async (e) => {
    e.preventDefault()

    if (!editingProduct || !formData.name) {
      alert(t('Please fill in all required fields'))
      return
    }

    setUpdating(true)

    try {
      const updates = {}
      if (formData.name !== editingProduct.name) updates.name = formData.name
      if (formData.description !== editingProduct.description) updates.description = formData.description

      // Note: We can't update price easily since it requires creating a new price in Stripe
      // For now, we'll only allow updating name and description

      if (Object.keys(updates).length === 0) {
        setEditingProduct(null)
        setUpdating(false)
        return
      }

      // Note: updateProduct requires the database product ID, not the Stripe product ID
      // For now, we'll show a message that this feature needs database product IDs
      // In production, you'd need to fetch/store the database product ID
      alert(t('Product updates require database product IDs. This feature is coming soon.'))

      // TODO: Implement full update when database product IDs are available
      // const result = await dispatch(updateProduct(editingProduct.databaseId, updates))
      // if (result.error) {
      //   throw new Error(result.error.message)
      // }

      setEditingProduct(null)
      setFormData({ name: '', description: '', price: '', currency: 'usd' })
      onRefreshProducts()
    } catch (error) {
      console.error('Error updating product:', error)
      alert(t('Failed to update product: {{error}}', { error: error.message }))
    } finally {
      setUpdating(false)
    }
  }, [dispatch, editingProduct, formData, onRefreshProducts, t])

  const handleStartEdit = useCallback((product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: '', // Price editing would be complex, skipping for now
      currency: 'usd'
    })
    setShowCreateForm(false)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingProduct(null)
    setFormData({ name: '', description: '', price: '', currency: 'usd' })
  }, [])

  return (
    <div className='bg-card p-6 rounded-md text-foreground shadow-xl'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h3 className='text-lg font-semibold'>{t('Products & Pricing')}</h3>
          <p className='text-sm text-foreground/70'>
            {t('Create products for memberships, tracks, or content access')}
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <PlusCircle className='w-4 h-4 mr-2' />
          {t('Add Product')}
        </Button>
      </div>

      {(showCreateForm || editingProduct) && (
        <form onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct} className='mb-6 p-4 bg-background rounded-md'>
          <h4 className='font-semibold mb-3'>
            {editingProduct ? t('Edit Product') : t('Create New Product')}
          </h4>

          <div className='space-y-3'>
            <SettingsControl
              label={t('Product Name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('e.g., Premium Membership')}
              required
            />

            <SettingsControl
              label={t('Description')}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('What does this product include?')}
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

            <div className='flex gap-2 justify-end'>
              <Button
                type='button'
                variant='outline'
                onClick={editingProduct ? handleCancelEdit : () => setShowCreateForm(false)}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='submit'
                disabled={creating || updating}
              >
                {creating ? t('Creating...') : updating ? t('Updating...') : editingProduct ? t('Update Product') : t('Create Product')}
              </Button>
            </div>
          </div>
        </form>
      )}

      {products.length === 0
        ? (
          <div className='text-center py-8 text-foreground/70'>
            <CreditCard className='w-12 h-12 mx-auto mb-2 opacity-50' />
            <p>{t('No products yet')}</p>
            <p className='text-sm'>{t('Create your first product to start accepting payments')}</p>
          </div>
        )
        : (
          <div className='space-y-3'>
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                groupSlug={group.slug}
                onEdit={handleStartEdit}
                t={t}
              />
            ))}
          </div>
        )}

      {products.length > 0 && (
        <div className='mt-4 p-3 bg-blue-500/10 border border-blue-500 rounded-md'>
          <p className='text-sm'>
            <strong>{t('Storefront Link:')}</strong>{' '}
            <a
              href={`/groups/${group.slug}/store`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-blue-600 hover:underline'
            >
              {window.location.origin}/groups/{group.slug}/store
            </a>
          </p>
          <p className='text-xs text-foreground/70 mt-1'>
            {t('Share this link with your members so they can view and purchase products')}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Card displaying a single product
 */
function ProductCard ({ product, groupSlug, onEdit, t }) {
  return (
    <div className='flex items-center justify-between p-3 bg-background rounded-md hover:bg-background/80 transition-colors'>
      <div className='flex-1'>
        <p className='font-medium'>{product.name}</p>
        {product.description && (
          <p className='text-sm text-foreground/70'>{product.description}</p>
        )}
      </div>
      <div className='flex items-center gap-3'>
        <div className='text-right'>
          <p className='text-sm text-foreground/70'>{t('ID')}: {product.id}</p>
          {product.active
            ? (<span className='text-xs text-green-600 font-medium'>{t('Active')}</span>)
            : (<span className='text-xs text-gray-600'>{t('Inactive')}</span>)}
        </div>
        {onEdit && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => onEdit(product)}
          >
            {t('Edit')}
          </Button>
        )}
      </div>
    </div>
  )
}

export default PaidContentTab
