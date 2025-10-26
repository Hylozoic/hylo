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
  createProduct,
  fetchProducts
} from './PaidContentTab.store'
import { updateGroupSettings } from '../GroupSettings.store'

/**
 * Main PaidContentTab component
 * Orchestrates the Stripe Connect integration UI
 */
function PaidContentTab ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  // Local state for managing Stripe account and products
  const [state, setState] = useState({
    accountId: group?.stripeAccountId || '',
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
    if (group?.stripeAccountId && group.stripeAccountId !== state.accountId) {
      setState(prev => ({ ...prev, accountId: group.stripeAccountId }))
    }
  }, [group?.stripeAccountId])

  // Load account status if we have an account ID
  useEffect(() => {
    if (state.accountId && group?.id) {
      loadAccountStatus()
      loadProducts()
    }
  }, [state.accountId, group?.id])

  /**
   * Creates a new Stripe Connected Account for this group
   *
   * This is the first step in enabling payments. Once the account is created,
   * the group admin needs to complete onboarding via an Account Link.
   */
  const handleCreateAccount = useCallback(async () => {
    if (!group) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await dispatch(createConnectedAccount(
        group.id,
        group.contactEmail || '', // TODO STRIPE: Use appropriate email field
        group.name,
        'US' // TODO STRIPE: Make country selectable or detect from user
      ))

      if (result.error) {
        throw new Error(result.error.message || 'Failed to create connected account')
      }

      const accountId = result.payload?.data?.createStripeConnectedAccount?.accountId

      if (!accountId) {
        throw new Error('No account ID returned from server')
      }

      // Save accountId to your group model in the database
      await dispatch(updateGroupSettings(group.id, { stripeAccountId: accountId }))

      setState(prev => ({
        ...prev,
        accountId,
        loading: false
      }))

      // Automatically trigger onboarding after account creation
      handleStartOnboarding(accountId)
    } catch (error) {
      console.error('Error creating connected account:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }, [dispatch, group])

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
   * Refreshes account status - useful after returning from onboarding
   */
  const handleRefreshStatus = useCallback(() => {
    loadAccountStatus()
    loadProducts()
  }, [loadAccountStatus, loadProducts])

  if (!group) return <Loading />

  const { accountId, accountStatus, products, loading, error } = state

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
        {!accountId ? (
          <AccountSetupSection
            loading={loading}
            onCreateAccount={handleCreateAccount}
            t={t}
          />
        ) : (
          <>
            <AccountStatusSection
              accountStatus={accountStatus}
              loading={loading}
              onStartOnboarding={handleStartOnboarding}
              onRefreshStatus={handleRefreshStatus}
              t={t}
            />

            <ProductManagementSection
              group={group}
              accountId={accountId}
              products={products}
              onRefreshProducts={loadProducts}
              t={t}
            />
          </>
        )}
      </SettingsSection>
    </div>
  )
}

/**
 * Section for initial account setup
 *
 * Displayed when the group doesn't have a Stripe account yet.
 */
function AccountSetupSection ({ loading, onCreateAccount, t }) {
  return (
    <div className='bg-card p-6 rounded-md text-foreground shadow-xl'>
      <div className='flex items-start gap-4'>
        <CreditCard className='w-12 h-12 text-primary flex-shrink-0' />
        <div className='flex-1'>
          <h3 className='text-lg font-semibold mb-2'>{t('Get started with payments')}</h3>
          <p className='text-foreground/70 mb-4'>
            {t('Create a Stripe Connect account to start accepting payments. This allows your group to receive payments directly while maintaining security and compliance.')}
          </p>
          <ul className='text-sm text-foreground/70 mb-4 space-y-1 list-disc list-inside'>
            <li>{t('Accept credit card and other payment methods')}</li>
            <li>{t('Automatic payouts to your bank account')}</li>
            <li>{t('Full dashboard access to view transactions')}</li>
            <li>{t('Stripe handles all payment disputes and fraud')}</li>
          </ul>
          <Button
            onClick={onCreateAccount}
            disabled={loading}
            className='w-full sm:w-auto'
          >
            {loading ? t('Creating account...') : t('Create Stripe Account')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Section showing account onboarding status
 *
 * Displays the current state of the connected account and provides
 * actions to complete onboarding or view the Stripe dashboard.
 */
function AccountStatusSection ({ accountStatus, loading, onStartOnboarding, onRefreshStatus, t }) {
  if (loading && !accountStatus) {
    return (
      <div className='bg-card p-6 rounded-md text-foreground shadow-xl'>
        <Loading />
      </div>
    )
  }

  const isFullyOnboarded = accountStatus?.chargesEnabled && accountStatus?.payoutsEnabled
  const needsOnboarding = !accountStatus?.detailsSubmitted

  return (
    <div className='bg-card p-6 rounded-md text-foreground shadow-xl mb-4'>
      <div className='flex items-start justify-between mb-4'>
        <div className='flex items-start gap-3'>
          {isFullyOnboarded ? (
            <CheckCircle className='w-8 h-8 text-green-500 flex-shrink-0' />
          ) : (
            <AlertCircle className='w-8 h-8 text-amber-500 flex-shrink-0' />
          )}
          <div>
            <h3 className='text-lg font-semibold mb-1'>
              {isFullyOnboarded ? t('Account Active') : t('Account Setup Required')}
            </h3>
            <p className='text-sm text-foreground/70'>
              {isFullyOnboarded
                ? t('Your Stripe account is fully set up and ready to accept payments.')
                : t('Complete your account setup to start accepting payments.')
              }
            </p>
          </div>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={onRefreshStatus}
        >
          {t('Refresh')}
        </Button>
      </div>

      {accountStatus && (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4'>
          <StatusBadge
            label={t('Accept Payments')}
            value={accountStatus.chargesEnabled}
            t={t}
          />
          <StatusBadge
            label={t('Receive Payouts')}
            value={accountStatus.payoutsEnabled}
            t={t}
          />
          <StatusBadge
            label={t('Details Submitted')}
            value={accountStatus.detailsSubmitted}
            t={t}
          />
        </div>
      )}

      {needsOnboarding && (
        <Button
          onClick={() => onStartOnboarding()}
          className='w-full sm:w-auto'
        >
          <ExternalLink className='w-4 h-4 mr-2' />
          {t('Complete Onboarding')}
        </Button>
      )}

      {accountStatus?.requirements && accountStatus.requirements.currently_due?.length > 0 && (
        <div className='mt-4 p-3 bg-amber-500/10 border border-amber-500 rounded-md'>
          <p className='text-sm font-semibold mb-1'>{t('Action Required')}</p>
          <p className='text-sm text-foreground/70'>
            {t('There are {{count}} items that need your attention.', { count: accountStatus.requirements.currently_due.length })}
          </p>
        </div>
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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'usd'
  })
  const [creating, setCreating] = useState(false)

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

      {showCreateForm && (
        <form onSubmit={handleCreateProduct} className='mb-6 p-4 bg-background rounded-md'>
          <h4 className='font-semibold mb-3'>{t('Create New Product')}</h4>

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
                onClick={() => setShowCreateForm(false)}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='submit'
                disabled={creating}
              >
                {creating ? t('Creating...') : t('Create Product')}
              </Button>
            </div>
          </div>
        </form>
      )}

      {products.length === 0 ? (
        <div className='text-center py-8 text-foreground/70'>
          <CreditCard className='w-12 h-12 mx-auto mb-2 opacity-50' />
          <p>{t('No products yet')}</p>
          <p className='text-sm'>{t('Create your first product to start accepting payments')}</p>
        </div>
      ) : (
        <div className='space-y-3'>
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              groupSlug={group.slug}
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
function ProductCard ({ product, groupSlug, t }) {
  return (
    <div className='flex items-center justify-between p-3 bg-background rounded-md'>
      <div className='flex-1'>
        <p className='font-medium'>{product.name}</p>
        {product.description && (
          <p className='text-sm text-foreground/70'>{product.description}</p>
        )}
      </div>
      <div className='text-right'>
        <p className='text-sm text-foreground/70'>{t('ID')}: {product.id}</p>
        {product.active ? (
          <span className='text-xs text-green-600 font-medium'>{t('Active')}</span>
        ) : (
          <span className='text-xs text-gray-600'>{t('Inactive')}</span>
        )}
      </div>
    </div>
  )
}

export default PaidContentTab
