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

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link, Routes, Route, useLocation } from 'react-router-dom'
import { CreditCard, CheckCircle, AlertCircle, ExternalLink, PlusCircle, Edit, X } from 'lucide-react'

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
  fetchOfferings,
  updateOffering
} from './PaidContentTab.store'
import { fetchGroupSettings, updateGroupSettings } from '../GroupSettings.store'
import { getHost } from 'store/middleware/apiMiddleware'
import fetchGroupTracks from 'store/actions/fetchGroupTracks'
import getTracksForGroup from 'store/selectors/getTracksForGroup'
import useDebounce from 'hooks/useDebounce'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList, CommandItem } from 'components/ui/command'
import getCommonRoles from 'store/selectors/getCommonRoles'

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
              t={t}
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
  const tracks = useSelector(state => getTracksForGroup(state, { groupId: group?.id }))
  const commonRoles = useSelector(getCommonRoles)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingOffering, setEditingOffering] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'usd',
    duration: '',
    publishStatus: 'unpublished',
    lineItems: {
      tracks: [],
      groups: [],
      roles: []
    }
  })
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updatingPaywall, setUpdatingPaywall] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  // Fetch tracks when needed for content access editing and display
  useEffect(() => {
    if (group?.id && (showCreateForm || editingOffering || offerings?.length > 0)) {
      dispatch(fetchGroupTracks(group.id, { published: true }))
    }
  }, [dispatch, group?.id, showCreateForm, editingOffering, offerings?.length])

  /**
   * Validates if a group is ready to have a paywall enabled
   *
   * Checks:
   * 1. Group has a Stripe account ID
   * 2. Stripe account is verified (charges enabled, payouts enabled, details submitted)
   * 3. At least one offering exists that grants access to the group itself
   *
   * @returns {boolean} True if all conditions are met, false otherwise
   */
  const groupPaywallValidation = useCallback(() => {
    // Check if group has a Stripe account ID
    if (!group?.stripeAccountId) {
      return false
    }

    // Check if Stripe account is verified
    if (!group?.stripeChargesEnabled || !group?.stripePayoutsEnabled || !group?.stripeDetailsSubmitted) {
      return false
    }

    // Check if at least one offering grants access to the group
    if (!offerings || offerings.length === 0) {
      return false
    }

    // Scan offerings for one that includes group access and is published
    const hasGroupAccessOffering = offerings.some(offering => {
      // First check if offering is published
      if (offering.publishStatus !== 'published') {
        return false
      }

      if (!offering.contentAccess) {
        return false
      }

      // Parse contentAccess (might be string or object)
      let contentAccess = {}
      if (typeof offering.contentAccess === 'string') {
        try {
          contentAccess = JSON.parse(offering.contentAccess)
        } catch {
          return false
        }
      } else {
        contentAccess = offering.contentAccess
      }

      // Check if contentAccess includes the current group's ID
      if (contentAccess.groupIds && Array.isArray(contentAccess.groupIds)) {
        return contentAccess.groupIds.some(groupId => parseInt(groupId) === parseInt(group?.id))
      }

      return false
    })

    return hasGroupAccessOffering
  }, [group, offerings])

  const isPaywallReady = groupPaywallValidation()

  const handleTogglePaywall = useCallback(async (e) => {
    if (!group) return

    const newPaywallValue = e.target.checked
    setUpdatingPaywall(true)

    try {
      await dispatch(updateGroupSettings(group.id, { paywall: newPaywallValue }))
      // Refresh group data to get updated paywall value
      if (group?.slug) {
        await dispatch(fetchGroupSettings(group.slug))
      }
    } catch (error) {
      console.error('Error updating paywall:', error)
      alert(t('Failed to update paywall setting: {{error}}', { error: error.message }))
    } finally {
      setUpdatingPaywall(false)
    }
  }, [dispatch, group, t])

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

      // Format contentAccess from line items
      // Format: { "trackIds": [1, 2], "roleIds": [3, 4], "groupIds": [5, 6] }
      const contentAccess = {}
      if (formData.lineItems.tracks.length > 0) {
        contentAccess.trackIds = formData.lineItems.tracks.map(t => parseInt(t.id))
      }
      if (formData.lineItems.roles.length > 0) {
        contentAccess.roleIds = formData.lineItems.roles.map(r => parseInt(r.id))
      }
      if (formData.lineItems.groups.length > 0) {
        contentAccess.groupIds = formData.lineItems.groups.map(g => parseInt(g.id))
      }

      const result = await dispatch(createOffering(
        group.id,
        accountId,
        formData.name,
        formData.description,
        priceInCents,
        formData.currency,
        Object.keys(contentAccess).length > 0 ? contentAccess : null,
        formData.duration || null,
        formData.publishStatus || 'unpublished'
      ))

      if (result.error) {
        throw new Error(result.error.message)
      }

      // Reset form and refresh offerings
      setFormData({ name: '', description: '', price: '', currency: 'usd', duration: '', publishStatus: 'unpublished', lineItems: { tracks: [], groups: [], roles: [] } })
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
      if (!editingOffering.id) {
        throw new Error(t('Cannot update offering: missing offering ID'))
      }

      // Format contentAccess from line items
      const contentAccess = {}
      if (formData.lineItems.tracks.length > 0) {
        contentAccess.trackIds = formData.lineItems.tracks.map(t => parseInt(t.id))
      }
      if (formData.lineItems.roles.length > 0) {
        contentAccess.roleIds = formData.lineItems.roles.map(r => parseInt(r.id))
      }
      if (formData.lineItems.groups.length > 0) {
        contentAccess.groupIds = formData.lineItems.groups.map(g => parseInt(g.id))
      }

      // Parse existing contentAccess for comparison
      let existingContentAccess = {}
      if (editingOffering.contentAccess) {
        if (typeof editingOffering.contentAccess === 'string') {
          try {
            existingContentAccess = JSON.parse(editingOffering.contentAccess)
          } catch {
            existingContentAccess = {}
          }
        } else {
          existingContentAccess = editingOffering.contentAccess
        }
      }

      // Normalize for comparison
      const normalizeContentAccess = (ca) => {
        const normalized = {}
        if (ca.trackIds && ca.trackIds.length > 0) normalized.trackIds = [...ca.trackIds].sort()
        if (ca.roleIds && ca.roleIds.length > 0) normalized.roleIds = [...ca.roleIds].sort()
        if (ca.groupIds && ca.groupIds.length > 0) normalized.groupIds = [...ca.groupIds].sort()
        return normalized
      }

      const updates = {}
      if (formData.name !== editingOffering.name) updates.name = formData.name
      if (formData.description !== (editingOffering.description || '')) updates.description = formData.description || null
      if (formData.duration !== (editingOffering.duration || '')) updates.duration = formData.duration || null
      if (formData.publishStatus !== (editingOffering.publishStatus || 'unpublished')) updates.publishStatus = formData.publishStatus || 'unpublished'

      // Compare contentAccess
      const normalizedNew = normalizeContentAccess(contentAccess)
      const normalizedExisting = normalizeContentAccess(existingContentAccess)
      const contentAccessChanged = JSON.stringify(normalizedNew) !== JSON.stringify(normalizedExisting)
      if (contentAccessChanged) {
        updates.contentAccess = Object.keys(contentAccess).length > 0 ? contentAccess : null
      }

      if (Object.keys(updates).length === 0) {
        setEditingOffering(null)
        setUpdating(false)
        return
      }

      const result = await dispatch(updateOffering(editingOffering.id, updates))

      if (result.error) {
        throw new Error(result.error.message)
      }

      const responseData = result.payload?.getData ? result.payload.getData() : result.payload?.data?.updateStripeOffering

      if (!responseData || !responseData.success) {
        throw new Error(responseData?.message || t('Failed to update offering'))
      }

      // Reset form and refresh offerings
      setEditingOffering(null)
      setFormData({ name: '', description: '', price: '', currency: 'usd', duration: '', publishStatus: 'unpublished', lineItems: { tracks: [], groups: [], roles: [] } })
      onRefreshOfferings()
    } catch (error) {
      console.error('Error updating offering:', error)
      alert(t('Failed to update offering: {{error}}', { error: error.message }))
    } finally {
      setUpdating(false)
    }
  }, [dispatch, editingOffering, formData, onRefreshOfferings, t])

  const handleStartEdit = useCallback((offering) => {
    console.log('Starting edit for offering:', offering)
    // Parse contentAccess and convert to lineItems format
    let contentAccess = {}
    if (offering.contentAccess) {
      if (typeof offering.contentAccess === 'string') {
        try {
          contentAccess = JSON.parse(offering.contentAccess)
          console.log('Parsed contentAccess from string:', contentAccess)
        } catch (e) {
          console.error('Error parsing contentAccess JSON:', e, offering.contentAccess)
          contentAccess = {}
        }
      } else {
        contentAccess = offering.contentAccess
        console.log('Using contentAccess as object:', contentAccess)
      }
    } else {
      console.log('No contentAccess found in offering')
    }

    // Get roles for lookup
    const groupRoles = group?.groupRoles?.items || []
    const allRoles = [
      ...commonRoles.map(role => ({ ...role, type: 'common' })),
      ...groupRoles.map(role => ({ ...role, type: 'group' }))
    ]

    console.log('Available tracks:', tracks.length, tracks.map(t => ({ id: t.id, name: t.name })))
    console.log('Available roles:', allRoles.length, allRoles.map(r => ({ id: r.id, name: r.name })))

    // Convert IDs to objects
    const lineItems = {
      tracks: (contentAccess.trackIds || []).map(trackId => {
        const track = tracks.find(t => parseInt(t.id) === parseInt(trackId))
        if (!track) {
          console.warn('Track not found for ID:', trackId)
        }
        return track ? { id: track.id, name: track.name } : null
      }).filter(Boolean),
      roles: (contentAccess.roleIds || []).map(roleId => {
        const role = allRoles.find(r => parseInt(r.id) === parseInt(roleId))
        if (!role) {
          console.warn('Role not found for ID:', roleId)
        }
        return role ? { id: role.id, name: role.name, emoji: role.emoji } : null
      }).filter(Boolean),
      groups: (contentAccess.groupIds || []).map(groupId => {
        // For groups, we can use the current group if it matches, or create a placeholder
        if (parseInt(groupId) === parseInt(group?.id)) {
          return { id: group.id, name: group.name }
        }
        return { id: groupId, name: t('Group {{id}}', { id: groupId }) }
      })
    }

    console.log('Converted lineItems:', lineItems)

    setEditingOffering(offering)
    setFormData({
      name: offering.name || '',
      description: offering.description || '',
      price: '',
      currency: 'usd',
      duration: offering.duration || '',
      publishStatus: offering.publishStatus || 'unpublished',
      lineItems
    })
    setShowCreateForm(false)
  }, [group, tracks, commonRoles, t])

  const handleCancelEdit = useCallback(() => {
    setEditingOffering(null)
    setFormData({ name: '', description: '', price: '', currency: 'usd', duration: '', publishStatus: 'unpublished', lineItems: { tracks: [], groups: [], roles: [] } })
    setShowCreateForm(false)
  }, [])

  const handleDiscardForm = useCallback(() => {
    setShowCreateForm(false)
    setFormData({ name: '', description: '', price: '', currency: 'usd', duration: '', publishStatus: 'unpublished', lineItems: { tracks: [], groups: [], roles: [] } })
  }, [])

  return (
    <div className='flex flex-col gap-4 mt-4 pb-4'>
      <div className='border-2 border-foreground/20 rounded-lg p-4 mb-2'>
        <SettingsControl
          label={t('Group Paywall Enabled')}
          helpText={t('When enabled, users must purchase access to join this group')}
          renderControl={() => (
            <div className='flex flex-col gap-2'>
              <div className='flex items-center gap-2'>
                <input
                  type='checkbox'
                  checked={group?.paywall || false}
                  onChange={handleTogglePaywall}
                  disabled={updatingPaywall || !group || (!group?.paywall && !isPaywallReady)}
                  className='w-4 h-4'
                />
                <span className='text-sm text-foreground/70'>
                  {group?.paywall ? t('Yes') : t('No')}
                </span>
              </div>
              <div className='text-xs mt-1'>
                {isPaywallReady
                  ? (<span className='text-accent'>{t('This group is ready to have a paywall added')}</span>)
                  : (<span className='text-destructive'>{t('To have a paywall to group access, the group needs to have a Stripe Connect account, have that account verified and then have at least ONE offering that allows access to the group')}</span>)}
              </div>
            </div>
          )}
        />
      </div>

      <button
        className='w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md flex flex-row items-center gap-2 justify-center'
        onClick={() => setShowCreateForm(true)}
      >
        <PlusCircle className='w-4 h-4' />
        <span>{t('Create Offering')}</span>
      </button>

      {showCreateForm && (
        <div className='border-2 border-foreground/20 rounded-lg p-4'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold'>{t('Create New Offering')}</h3>
            <button
              type='button'
              onClick={handleDiscardForm}
              className='text-foreground/70 hover:text-foreground transition-colors'
              aria-label={t('Close')}
            >
              <X className='w-5 h-5' />
            </button>
          </div>
          <form onSubmit={handleCreateOffering} className='space-y-4'>
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
            <SettingsControl
              label={t('Duration')}
              helpText={t('How long does access last? Leave empty for lifetime access')}
              value={formData.duration}
              onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
              renderControl={(props) => (
                <select {...props} className='w-full p-2 rounded-md bg-background border border-border'>
                  <option value=''>{t('Lifetime / No expiration')}</option>
                  <option value='month'>{t('1 Month')}</option>
                  <option value='season'>{t('1 Season (3 months)')}</option>
                  <option value='annual'>{t('1 Year')}</option>
                </select>
              )}
            />

            <SettingsControl
              label={t('Publish Status')}
              helpText={t('Control when and how this offering is visible')}
              value={formData.publishStatus}
              onChange={(e) => setFormData(prev => ({ ...prev, publishStatus: e.target.value }))}
              renderControl={(props) => (
                <select {...props} className='w-full p-2 rounded-md bg-background border border-border'>
                  <option value='unpublished'>{t('Unpublished')}</option>
                  <option value='unlisted'>{t('Unlisted')}</option>
                  <option value='published'>{t('Published')}</option>
                  <option value='archived'>{t('Archived')}</option>
                </select>
              )}
            />

            <LineItemsSelector
              group={group}
              lineItems={formData.lineItems}
              onLineItemsChange={(lineItems) => setFormData(prev => ({ ...prev, lineItems }))}
              t={t}
            />

            <div className='flex gap-2 justify-end pt-2 border-t border-foreground/10'>
              <Button
                type='button'
                variant='outline'
                onClick={handleDiscardForm}
              >
                {t('Discard')}
              </Button>
              <Button
                type='submit'
                disabled={creating}
              >
                {creating ? t('Creating...') : t('Save')}
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
            <SettingsControl
              label={t('Duration')}
              helpText={t('How long does access last? Leave empty for lifetime access')}
              value={formData.duration}
              onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
              renderControl={(props) => (
                <select {...props} className='w-full p-2 rounded-md bg-background border border-border'>
                  <option value=''>{t('Lifetime / No expiration')}</option>
                  <option value='month'>{t('1 Month')}</option>
                  <option value='season'>{t('1 Season (3 months)')}</option>
                  <option value='annual'>{t('1 Year')}</option>
                </select>
              )}
            />

            <SettingsControl
              label={t('Publish Status')}
              helpText={t('Control when and how this offering is visible')}
              value={formData.publishStatus}
              onChange={(e) => setFormData(prev => ({ ...prev, publishStatus: e.target.value }))}
              renderControl={(props) => (
                <select {...props} className='w-full p-2 rounded-md bg-background border border-border'>
                  <option value='unpublished'>{t('Unpublished')}</option>
                  <option value='unlisted'>{t('Unlisted')}</option>
                  <option value='published'>{t('Published')}</option>
                  <option value='archived'>{t('Archived')}</option>
                </select>
              )}
            />

            <LineItemsSelector
              group={group}
              lineItems={formData.lineItems}
              onLineItemsChange={(lineItems) => setFormData(prev => ({ ...prev, lineItems }))}
              t={t}
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
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-xl font-semibold'>{t('Offerings')}</h3>
          <div className='flex items-center gap-2'>
            <label className='text-sm text-foreground/70 flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className='w-4 h-4'
              />
              <span>{t('Show archived')}</span>
            </label>
          </div>
        </div>
        <div className='flex flex-col gap-3'>
          {(() => {
            const filteredOfferings = showArchived
              ? offerings
              : offerings.filter(offering => offering.publishStatus !== 'archived')

            if (filteredOfferings.length === 0) {
              return (
        <div className='text-center py-8 text-foreground/70'>
          <CreditCard className='w-12 h-12 mx-auto mb-2 opacity-50' />
                  <p>{t('No offerings yet')}</p>
                  <p className='text-sm'>{t('Create your first offering to start accepting payments')}</p>
        </div>
              )
            }

            return filteredOfferings.map(offering => (
              <OfferingListItem
                key={offering.id}
                offering={offering}
                onEdit={handleStartEdit}
                group={group}
                isEditing={editingOffering?.id === offering.id}
              t={t}
            />
            ))
          })()}
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
function OfferingListItem ({ offering, onEdit, group, isEditing, t }) {
  // Parse contentAccess JSON
  const contentAccess = useMemo(() => {
    if (!offering.contentAccess) {
      return {}
    }
    // If it's a string, parse it
    if (typeof offering.contentAccess === 'string') {
      try {
        return JSON.parse(offering.contentAccess)
      } catch (e) {
        console.error('Error parsing contentAccess JSON:', e, offering.contentAccess)
        return {}
      }
    }
    // If it's already an object, use it directly
    return offering.contentAccess || {}
  }, [offering.contentAccess])

  // Get tracks, roles, and groups from the group data
  const tracks = useSelector(state => getTracksForGroup(state, { groupId: group?.id }))
  const commonRoles = useSelector(getCommonRoles)
  const groupRoles = useMemo(() => group?.groupRoles?.items || [], [group?.groupRoles?.items])
  const allRoles = useMemo(() => [
    ...commonRoles.map(role => ({ ...role, type: 'common' })),
    ...groupRoles.map(role => ({ ...role, type: 'group' }))
  ], [commonRoles, groupRoles])

  // Get track and role objects for display (keep full objects for chips)
  const accessDetails = useMemo(() => {
    const details = {
      tracks: [],
      roles: [],
      hasGroups: false
    }

    // Debug: log what we're working with
    if (offering.contentAccess) {
      console.log('Offering contentAccess:', offering.contentAccess, 'Parsed:', contentAccess)
      console.log('Available tracks:', tracks.length, tracks.map(t => ({ id: t.id, name: t.name })))
      console.log('Available roles:', allRoles.length, allRoles.map(r => ({ id: r.id, name: r.name })))
    }

    if (contentAccess.trackIds && Array.isArray(contentAccess.trackIds)) {
      details.tracks = contentAccess.trackIds
        .map(trackId => {
          const track = tracks.find(t => parseInt(t.id) === parseInt(trackId))
          if (!track) {
            console.warn('Track not found for ID:', trackId, 'Available tracks:', tracks.map(t => t.id))
          }
          return track
        })
        .filter(Boolean)
    }

    if (contentAccess.roleIds && Array.isArray(contentAccess.roleIds)) {
      details.roles = contentAccess.roleIds
        .map(roleId => {
          const role = allRoles.find(r => parseInt(r.id) === parseInt(roleId))
          if (!role) {
            console.warn('Role not found for ID:', roleId, 'Available roles:', allRoles.map(r => r.id))
          }
          return role
        })
        .filter(Boolean)
    }

    // Since we only allow the current group, just check if groups exist
    if (contentAccess.groupIds && Array.isArray(contentAccess.groupIds) && contentAccess.groupIds.length > 0) {
      details.hasGroups = true
    }

    return details
  }, [contentAccess, tracks, allRoles, offering.contentAccess])

  const hasAccessContent = accessDetails.tracks.length > 0 || accessDetails.roles.length > 0 || accessDetails.hasGroups

  return (
    <div className={`border-2 rounded-lg p-4 transition-all ${isEditing ? 'border-blue-500 bg-blue-500/10 opacity-75' : 'border-foreground/20 hover:border-foreground/40'}`}>
      <div className='flex items-start justify-between'>
      <div className='flex-1'>
          <div className='flex items-center gap-2 mb-2'>
            <h4 className='font-semibold text-foreground'>{offering.name}</h4>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              offering.publishStatus === 'published'
                ? 'bg-green-500/20 text-green-600'
                : offering.publishStatus === 'unlisted'
                  ? 'bg-blue-500/20 text-blue-600'
                  : offering.publishStatus === 'archived'
                    ? 'bg-gray-500/20 text-gray-600'
                    : 'bg-yellow-500/20 text-yellow-600'
            }`}>
              {offering.publishStatus === 'published' ? t('Published') : offering.publishStatus === 'unlisted' ? t('Unlisted') : offering.publishStatus === 'archived' ? t('Archived') : t('Unpublished')}
            </span>
          </div>
          {offering.description && (
            <p className='text-sm text-foreground/70 mb-2'>{offering.description}</p>
          )}
          <div className='flex items-center gap-4 text-xs text-foreground/50 mb-2'>
            {offering.priceInCents && (
              <span>{t('Price')}: ${(offering.priceInCents / 100).toFixed(2)} {offering.currency?.toUpperCase()}</span>
            )}
            {offering.duration && (
              <span>{t('Duration')}: {offering.duration === 'month' ? t('1 Month') : offering.duration === 'season' ? t('1 Season') : offering.duration === 'annual' ? t('1 Year') : offering.duration}</span>
            )}
            {!offering.duration && (
              <span>{t('Duration')}: {t('Lifetime')}</span>
        )}
      </div>
          {hasAccessContent && (
            <div className='mt-3 pt-3 border-t border-foreground/10'>
              {accessDetails.hasGroups && (
                <div className='mb-3'>
                  <p className='text-sm font-bold text-foreground'>{t('Grants access to the group')}</p>
                </div>
              )}
              {(accessDetails.tracks.length > 0 || accessDetails.roles.length > 0) && (
                <>
                  <p className='text-xs font-semibold text-foreground/70 mb-2'>{t('Grants access to')}:</p>
                  <div className='flex flex-col gap-2 text-xs text-foreground/60'>
                    {accessDetails.tracks.length > 0 && (
                      <div>
                        <span className='font-medium mb-1 block'>{t('Tracks')}:</span>
                        <div className='flex flex-wrap gap-2'>
                          {accessDetails.tracks.map(track => (
                            <span
                              key={track.id}
                              className='inline-flex items-center gap-1 px-2 py-1 rounded-md bg-selected/20 text-foreground text-sm'
                            >
                              {track.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {accessDetails.roles.length > 0 && (
                      <div>
                        <span className='font-medium mb-1 block'>{t('Roles')}:</span>
                        <div className='flex flex-wrap gap-2'>
                          {accessDetails.roles.map(role => (
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
              )}
            </div>
          )}
        </div>
        {onEdit && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => !isEditing && onEdit(offering)}
            disabled={isEditing}
            className='ml-4'
          >
            <Edit className='w-4 h-4 mr-1' />
            {isEditing ? t('Editing...') : t('Edit')}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Line Items Selector Component
 *
 * Allows selection of tracks, groups, and roles to attach to an offering.
 * Selected items are displayed as removable chips.
 */
function LineItemsSelector ({ group, lineItems, onLineItemsChange, t }) {
  const dispatch = useDispatch()
  const [activeSelector, setActiveSelector] = useState(null) // 'track', 'group', or 'role'
  const [searchTerm, setSearchTerm] = useState('')
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Get roles (combine common roles and group roles, like TagInput does)
  const commonRoles = useSelector(getCommonRoles)
  const groupRoles = useMemo(() => group?.groupRoles?.items || [], [group?.groupRoles?.items])
  const allRoles = useMemo(() => [
    ...commonRoles.map(role => ({ ...role, type: 'common', label: `${role.emoji || ''} ${role.name}`.trim() })),
    ...groupRoles.map(role => ({ ...role, type: 'group', label: `${role.emoji || ''} ${role.name}`.trim() }))
  ], [commonRoles, groupRoles])

  // Fetch tracks when track selector is active
  useEffect(() => {
    async function getTracks () {
      if (activeSelector !== 'track') return

      setIsLoading(true)
      try {
        const response = await dispatch(fetchGroupTracks(group.id, {
          autocomplete: debouncedSearch || '',
          first: 20,
          published: true
        }))
        setItems(response?.payload?.data?.group?.tracks?.items || [])
      } catch (error) {
        console.error('Error fetching tracks:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getTracks()
  }, [debouncedSearch, dispatch, activeSelector, group.id])

  // Set current group when group selector is active
  useEffect(() => {
    if (activeSelector === 'group') {
      setIsLoading(false)
      // Only allow selecting the current group
      setItems(group ? [group] : [])
    }
  }, [activeSelector, group])

  // Filter roles when role selector is active
  useEffect(() => {
    if (activeSelector === 'role') {
      setIsLoading(false)
      // Filter out already selected roles
      const unselectedRoles = allRoles.filter(role =>
        !lineItems.roles.some(selected => selected.id === role.id)
      )

      if (!debouncedSearch) {
        setItems(unselectedRoles)
      } else {
        const searchLower = debouncedSearch.toLowerCase()
        const filteredRoles = unselectedRoles.filter(role =>
          role.name.toLowerCase().includes(searchLower)
        )
        setItems(filteredRoles)
      }
    }
  }, [debouncedSearch, activeSelector, allRoles, lineItems.roles])

  const handleSelectItem = useCallback((item) => {
    const itemType = activeSelector === 'track' ? 'tracks' : activeSelector === 'group' ? 'groups' : 'roles'
    const currentItems = lineItems[itemType] || []

    // Check if item is already selected
    if (currentItems.find(i => i.id === item.id)) {
      return
    }

    onLineItemsChange({
      ...lineItems,
      [itemType]: [...currentItems, item]
    })

    // Reset selector
    setActiveSelector(null)
    setSearchTerm('')
  }, [activeSelector, lineItems, onLineItemsChange])

  const handleRemoveItem = useCallback((itemType, itemId) => {
    onLineItemsChange({
      ...lineItems,
      [itemType]: lineItems[itemType].filter(item => item.id !== itemId)
    })
  }, [lineItems, onLineItemsChange])

  const textOptions = {
    track: {
      searchPlaceholder: t('Search tracks...'),
      noResults: t('No tracks found'),
      heading: t('Tracks'),
      buttonLabel: t('Add Track')
    },
    group: {
      searchPlaceholder: t('Search groups...'),
      noResults: t('No groups found'),
      heading: t('Groups'),
      buttonLabel: t('Add Group')
    },
    role: {
      searchPlaceholder: t('Search roles...'),
      noResults: t('No roles found'),
      heading: t('Roles'),
      buttonLabel: t('Add Role')
    }
  }

  return (
    <div className='space-y-4'>
      <div>
        <label className='text-sm font-semibold text-foreground mb-2 block'>
          {t('Content Access')}
        </label>
        <p className='text-xs text-foreground/60 mb-3'>
          {t('Select tracks, groups, and roles that this offering grants access to')}
        </p>

        {/* Selected Items Display */}
        <div className='space-y-2 mb-4'>
          {lineItems.tracks.length > 0 && (
            <div>
              <p className='text-xs text-foreground/50 mb-1'>{t('Tracks')}:</p>
              <div className='flex flex-wrap gap-2'>
                {lineItems.tracks.map(track => (
                  <span
                    key={track.id}
                    className='inline-flex items-center gap-1 px-2 py-1 rounded-md bg-selected/20 text-foreground text-sm'
                  >
                    {track.name}
                    <button
                      type='button'
                      onClick={() => handleRemoveItem('tracks', track.id)}
                      className='hover:text-destructive'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {lineItems.groups.length > 0 && (
            <div>
              <p className='text-xs text-foreground/50 mb-1'>{t('Groups')}:</p>
              <div className='flex flex-wrap gap-2'>
                {lineItems.groups.map(selectedGroup => (
                  <span
                    key={selectedGroup.id}
                    className='inline-flex items-center gap-1 px-2 py-1 rounded-md bg-selected/20 text-foreground text-sm'
                  >
                    {selectedGroup.name}
                    <button
                      type='button'
                      onClick={() => handleRemoveItem('groups', selectedGroup.id)}
                      className='hover:text-destructive'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {lineItems.roles.length > 0 && (
            <div>
              <p className='text-xs text-foreground/50 mb-1'>{t('Roles')}:</p>
              <div className='flex flex-wrap gap-2'>
                {lineItems.roles.map(role => (
                  <span
                    key={role.id}
                    className='inline-flex items-center gap-1 px-2 py-1 rounded-md bg-selected/20 text-foreground text-sm'
                  >
                    {role.emoji && <span>{role.emoji}</span>}
                    <span>{role.name}</span>
                    <button
                      type='button'
                      onClick={() => handleRemoveItem('roles', role.id)}
                      className='hover:text-destructive'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add Buttons */}
        <div className='flex gap-2 flex-wrap'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setActiveSelector(activeSelector === 'track' ? null : 'track')}
          >
            <PlusCircle className='w-4 h-4 mr-1' />
            {textOptions.track.buttonLabel}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setActiveSelector(activeSelector === 'group' ? null : 'group')}
          >
            <PlusCircle className='w-4 h-4 mr-1' />
            {textOptions.group.buttonLabel}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setActiveSelector(activeSelector === 'role' ? null : 'role')}
          >
            <PlusCircle className='w-4 h-4 mr-1' />
            {textOptions.role.buttonLabel}
          </Button>
        </div>

        {/* Search/Select Interface */}
        {activeSelector && (
          <div className='mt-3 border-2 border-foreground/20 rounded-lg p-3'>
            <Command className='rounded-lg border shadow-md'>
              <CommandInput
                placeholder={textOptions[activeSelector].searchPlaceholder}
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                {isLoading
                  ? <CommandEmpty>{t('Loading...')}</CommandEmpty>
                  : items.length === 0
                    ? <CommandEmpty>{textOptions[activeSelector].noResults}</CommandEmpty>
                    : (
                      <CommandGroup heading={textOptions[activeSelector].heading}>
                        {items.map((item) => {
                          const itemType = activeSelector === 'track' ? 'tracks' : activeSelector === 'group' ? 'groups' : 'roles'
                          const isSelected = lineItems[itemType].find(i => i.id === item.id)
                          return (
                            <CommandItem
                              key={item.id}
                              value={item.name}
                              onSelect={() => handleSelectItem(item)}
                              className={isSelected ? 'opacity-50 cursor-not-allowed' : ''}
                              disabled={isSelected}
                            >
                              {activeSelector === 'role' && item.emoji && <span className='mr-2'>{item.emoji}</span>}
                              <span>{item.name}</span>
                              {isSelected && <span className='ml-2 text-xs text-foreground/50'>({t('Already selected')})</span>}
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>)}
              </CommandList>
            </Command>
          </div>
        )}
      </div>
    </div>
  )
}

export default PaidContentTab
