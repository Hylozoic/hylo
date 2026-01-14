/**
 * OfferingsTab Components
 *
 * Contains components for managing offerings:
 * - OfferingsTab: Main tab with offerings list and forms
 * - OfferingListItem: Individual offering display
 * - LineItemsSelector: Selector for tracks, groups, and roles
 * - SubscribersPanel: Panel showing subscribers for an offering
 */

import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { CreditCard, AlertCircle, PlusCircle, Edit, X, Link2, Users, ChevronDown, ChevronUp } from 'lucide-react'
import CopyToClipboard from 'react-copy-to-clipboard'

import Button from 'components/ui/button'
import Loading from 'components/Loading'
import SettingsControl from 'components/SettingsControl'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList, CommandItem } from 'components/ui/command'

import { createOffering, updateOffering } from './PaidContentTab.store'
import { fetchGroupSettings, updateGroupSettings } from '../GroupSettings.store'
import { offeringUrl, origin } from '@hylo/navigation'
import fetchGroupTracks from 'store/actions/fetchGroupTracks'
import getTracksForGroup from 'store/selectors/getTracksForGroup'
import useDebounce from 'hooks/useDebounce'
import getCommonRoles from 'store/selectors/getCommonRoles'
import { parseAccessGrants, offeringHasTrackAccess, offeringHasGroupAccess, offeringHasRoleAccess, offeringGrantsGroupAccess } from 'util/accessGrants'
import { queryHyloAPI } from 'util/graphql'

/**
 * GraphQL query for fetching offering subscription stats
 */
const OFFERING_SUBSCRIPTION_STATS_QUERY = `
  query OfferingSubscriptionStats($offeringId: ID!, $groupId: ID!) {
    offeringSubscriptionStats(offeringId: $offeringId, groupId: $groupId) {
      activeCount
      lapsedCount
      monthlyRevenueCents
      currency
      success
      message
    }
  }
`

/**
 * GraphQL query for fetching paginated subscribers
 */
const OFFERING_SUBSCRIBERS_QUERY = `
  query OfferingSubscribers($offeringId: ID!, $groupId: ID!, $page: Int, $pageSize: Int, $lapsedOnly: Boolean) {
    offeringSubscribers(offeringId: $offeringId, groupId: $groupId, page: $page, pageSize: $pageSize, lapsedOnly: $lapsedOnly) {
      total
      hasMore
      page
      pageSize
      totalPages
      items {
        id
        userId
        userName
        userAvatarUrl
        status
        joinedAt
        expiresAt
      }
    }
  }
`

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
  const editFormRef = useRef(null)
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
  const [accessFilter, setAccessFilter] = useState('all')
  const [expandedOfferingId, setExpandedOfferingId] = useState(null)

  /**
   * Toggle subscriber view for an offering
   * Implements accordion behavior - only one offering can be expanded at a time
   */
  const handleToggleSubscribers = useCallback((offeringId) => {
    setExpandedOfferingId(prevId => prevId === offeringId ? null : offeringId)
  }, [])

  // Fetch tracks when needed for content access editing and display
  useEffect(() => {
    if (group?.id && (showCreateForm || editingOffering || offerings?.length > 0)) {
      dispatch(fetchGroupTracks(group.id, { published: true }))
    }
  }, [dispatch, group?.id, showCreateForm, editingOffering, offerings?.length])

  // Scroll to edit form when it opens
  useEffect(() => {
    if (editingOffering && editFormRef.current) {
      editFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [editingOffering])

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

      // Check if this offering grants access to the current group
      return offeringGrantsGroupAccess(offering, group?.id)
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
      window.alert(t('Failed to update paywall setting: {{error}}', { error: error.message }))
    } finally {
      setUpdatingPaywall(false)
    }
  }, [dispatch, group, t])

  const handleCreateOffering = useCallback(async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.price) {
      window.alert(t('Please fill in all required fields'))
      return
    }

    setCreating(true)

    try {
      const priceInCents = Math.round(parseFloat(formData.price) * 100)

      if (isNaN(priceInCents) || priceInCents < 0) {
        throw new Error(t('Invalid price'))
      }

      // Format accessGrants from line items
      // Format: { "trackIds": [1, 2], "roleIds": [3, 4], "groupIds": [5, 6] }
      const accessGrants = {}
      if (formData.lineItems.tracks.length > 0) {
        accessGrants.trackIds = formData.lineItems.tracks.map(track => parseInt(track.id))
      }
      if (formData.lineItems.roles.length > 0) {
        accessGrants.roleIds = formData.lineItems.roles.map(r => parseInt(r.id))
      }
      if (formData.lineItems.groups.length > 0) {
        accessGrants.groupIds = formData.lineItems.groups.map(g => parseInt(g.id))
      }

      const result = await dispatch(createOffering(
        group.id,
        accountId,
        formData.name,
        formData.description,
        priceInCents,
        formData.currency,
        Object.keys(accessGrants).length > 0 ? accessGrants : null,
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
      window.alert(t('Failed to create offering: {{error}}', { error: error.message }))
    } finally {
      setCreating(false)
    }
  }, [dispatch, group, accountId, formData, onRefreshOfferings, t])

  const handleUpdateOffering = useCallback(async (e) => {
    e.preventDefault()

    if (!editingOffering || !formData.name) {
      window.alert(t('Please fill in all required fields'))
      return
    }

    setUpdating(true)

    try {
      if (!editingOffering.id) {
        throw new Error(t('Cannot update offering: missing offering ID'))
      }

      // Format accessGrants from line items
      const accessGrants = {}
      if (formData.lineItems.tracks.length > 0) {
        accessGrants.trackIds = formData.lineItems.tracks.map(track => parseInt(track.id))
      }
      if (formData.lineItems.roles.length > 0) {
        accessGrants.roleIds = formData.lineItems.roles.map(r => parseInt(r.id))
      }
      if (formData.lineItems.groups.length > 0) {
        accessGrants.groupIds = formData.lineItems.groups.map(g => parseInt(g.id))
      }

      // Parse existing accessGrants for comparison
      const existingAccessGrants = parseAccessGrants(editingOffering.accessGrants)

      // Normalize for comparison
      const normalizeAccessGrants = (ag) => {
        const normalized = {}
        if (ag.trackIds && ag.trackIds.length > 0) normalized.trackIds = [...ag.trackIds].sort()
        if (ag.roleIds && ag.roleIds.length > 0) normalized.roleIds = [...ag.roleIds].sort()
        if (ag.groupIds && ag.groupIds.length > 0) normalized.groupIds = [...ag.groupIds].sort()
        return normalized
      }

      const updates = {}
      if (formData.name !== editingOffering.name) updates.name = formData.name
      if (formData.description !== (editingOffering.description || '')) updates.description = formData.description || null
      if (formData.duration !== (editingOffering.duration || '')) updates.duration = formData.duration || null
      if (formData.publishStatus !== (editingOffering.publishStatus || 'unpublished')) updates.publishStatus = formData.publishStatus || 'unpublished'

      // Compare accessGrants
      const normalizedNew = normalizeAccessGrants(accessGrants)
      const normalizedExisting = normalizeAccessGrants(existingAccessGrants)
      const accessGrantsChanged = JSON.stringify(normalizedNew) !== JSON.stringify(normalizedExisting)
      if (accessGrantsChanged) {
        updates.accessGrants = Object.keys(accessGrants).length > 0 ? accessGrants : null
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
      window.alert(t('Failed to update offering: {{error}}', { error: error.message }))
    } finally {
      setUpdating(false)
    }
  }, [dispatch, editingOffering, formData, onRefreshOfferings, t])

  const handleStartEdit = useCallback((offering) => {
    // Use tracks and roles relations from GraphQL, fallback to parsing accessGrants for backwards compatibility
    const offeringTracks = offering.tracks || []
    const offeringRoles = offering.roles || []
    const accessGrants = parseAccessGrants(offering.accessGrants)

    // Convert tracks relation to lineItems format
    const lineItems = {
      tracks: offeringTracks.map(track => ({
        id: track.id,
        name: track.name
      })),
      roles: offeringRoles.map(role => ({
        id: role.id,
        name: role.name,
        emoji: role.emoji
      })),
      groups: (accessGrants.groupIds || []).map(groupId => {
        // For groups, we can use the current group if it matches, or create a placeholder
        if (parseInt(groupId) === parseInt(group?.id)) {
          return { id: group.id, name: group.name }
        }
        return { id: groupId, name: t('Group {{id}}', { id: groupId }) }
      })
    }

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
                {isPaywallReady && group?.paywall
                  ? (<span className='text-accent'>{t('Paywall enabled')}</span>)
                  : isPaywallReady
                    ? (<span className='text-accent'>{t('This group is ready to have a paywall added')}</span>)
                    : (<span className='text-destructive'>{t('To have a paywall to group access, the group needs to have a Stripe Connect account, have that account verified and then have at least ONE published offering that allows access to the group')}</span>)}
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
                  <option value='day'>{t('1 Day (Testing)')}</option>
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
        <div ref={editFormRef} className='border-2 border-foreground/20 rounded-lg p-4'>
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
                  <option value='day'>{t('1 Day (Testing)')}</option>
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
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <label className='text-sm text-foreground/70'>{t('Offerings with')}:</label>
              <select
                value={accessFilter}
                onChange={(e) => setAccessFilter(e.target.value)}
                className='text-sm px-2 py-1 rounded-md bg-background border border-border text-foreground'
              >
                <option value='all'>{t('All')}</option>
                <option value='group'>{t('Group access')}</option>
                <option value='track'>{t('Track access')}</option>
                <option value='role'>{t('Role access')}</option>
              </select>
            </div>
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
            // First filter by archived status
            let filteredOfferings = showArchived
              ? offerings
              : offerings.filter(offering => offering.publishStatus !== 'archived')

            // Then filter by access type
            if (accessFilter !== 'all') {
              filteredOfferings = filteredOfferings.filter(offering => {
                if (accessFilter === 'group') {
                  return offeringHasGroupAccess(offering)
                } else if (accessFilter === 'track') {
                  return offeringHasTrackAccess(offering)
                } else if (accessFilter === 'role') {
                  return offeringHasRoleAccess(offering)
                }

                return false
              })
            }

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
                isExpanded={expandedOfferingId === offering.id}
                onToggleSubscribers={handleToggleSubscribers}
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
 * Subscribers Panel Component
 *
 * Displays subscription statistics and a list of subscribers for an offering.
 * Fetches data via GraphQL when rendered.
 */
function SubscribersPanel ({ offering, group, t }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [subscribers, setSubscribers] = useState([])
  const [subscribersPage, setSubscribersPage] = useState(1)
  const [subscribersMeta, setSubscribersMeta] = useState({ total: 0, hasMore: false, totalPages: 0 })
  const [showLapsedOnly, setShowLapsedOnly] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Fetch subscription stats from GraphQL API
   */
  const fetchStats = useCallback(async () => {
    if (!offering?.id || !group?.id) return

    try {
      const response = await queryHyloAPI({
        query: OFFERING_SUBSCRIPTION_STATS_QUERY,
        variables: {
          offeringId: offering.id,
          groupId: group.id
        }
      })

      if (response.errors) {
        throw new Error(response.errors[0]?.message || 'Failed to fetch stats')
      }

      const statsData = response.data?.offeringSubscriptionStats
      if (statsData?.success) {
        setStats(statsData)
      } else {
        throw new Error(statsData?.message || 'Failed to fetch stats')
      }
    } catch (err) {
      console.error('Error fetching subscription stats:', err)
      throw err
    }
  }, [offering?.id, group?.id])

  /**
   * Fetch subscribers list from GraphQL API
   */
  const fetchSubscribers = useCallback(async (page = 1, lapsedOnly = false) => {
    if (!offering?.id || !group?.id) return

    try {
      const response = await queryHyloAPI({
        query: OFFERING_SUBSCRIBERS_QUERY,
        variables: {
          offeringId: offering.id,
          groupId: group.id,
          page,
          pageSize: 50,
          lapsedOnly
        }
      })

      if (response.errors) {
        throw new Error(response.errors[0]?.message || 'Failed to fetch subscribers')
      }

      const subscribersData = response.data?.offeringSubscribers
      if (subscribersData) {
        setSubscribers(subscribersData.items || [])
        setSubscribersMeta({
          total: subscribersData.total,
          hasMore: subscribersData.hasMore,
          totalPages: subscribersData.totalPages
        })
        setSubscribersPage(subscribersData.page)
      }
    } catch (err) {
      console.error('Error fetching subscribers:', err)
      throw err
    }
  }, [offering?.id, group?.id])

  /**
   * Initial data fetch when component mounts or offering/group changes
   */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        await Promise.all([
          fetchStats(),
          fetchSubscribers(1, showLapsedOnly)
        ])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [fetchStats, fetchSubscribers, showLapsedOnly])

  /**
   * Handle page change for pagination
   */
  const handlePageChange = useCallback(async (newPage) => {
    setLoading(true)
    try {
      await fetchSubscribers(newPage, showLapsedOnly)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchSubscribers, showLapsedOnly])

  /**
   * Handle lapsed filter toggle
   */
  const handleLapsedFilterToggle = useCallback(async () => {
    const newLapsedOnly = !showLapsedOnly
    setShowLapsedOnly(newLapsedOnly)
    setLoading(true)
    try {
      await fetchSubscribers(1, newLapsedOnly)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [showLapsedOnly, fetchSubscribers])

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className='text-center py-4 text-red-500'>
        <AlertCircle className='w-8 h-8 mx-auto mb-2' />
        <p>{t('Error loading subscriber data')}: {error}</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* Summary Stats */}
      <div className='grid grid-cols-3 gap-4'>
        <div className='bg-background/50 rounded-lg p-3 text-center'>
          <p className='text-2xl font-bold text-foreground'>{stats?.activeCount || 0}</p>
          <p className='text-xs text-foreground/70'>{t('Active Subscribers')}</p>
        </div>
        <div className='bg-background/50 rounded-lg p-3 text-center'>
          <p className='text-2xl font-bold text-foreground'>
            ${((stats?.monthlyRevenueCents || 0) / 100).toFixed(2)}
          </p>
          <p className='text-xs text-foreground/70'>{t('Monthly Revenue')}</p>
        </div>
        <div className='bg-background/50 rounded-lg p-3 text-center'>
          <p className='text-2xl font-bold text-foreground/50'>{stats?.lapsedCount || 0}</p>
          <p className='text-xs text-foreground/70'>{t('Lapsed')}</p>
        </div>
      </div>

      {/* Subscriber List Section */}
      <div className='border-t border-foreground/10 pt-4'>
        {/* Filter Toggle */}
        <div className='flex items-center justify-between mb-3'>
          <p className='text-sm font-medium text-foreground'>
            {showLapsedOnly ? t('Lapsed Members') : t('Active Members')}
            <span className='text-foreground/50 ml-2'>({subscribersMeta.total})</span>
          </p>
          <Button
            variant='outline'
            size='sm'
            onClick={handleLapsedFilterToggle}
            className='text-xs'
          >
            {showLapsedOnly ? t('Show Active') : t('Show Lapsed')}
          </Button>
        </div>

        {/* Subscriber List */}
        {subscribers.length === 0 && (
          <div className='text-center py-4 text-foreground/50 text-sm'>
            <Users className='w-6 h-6 mx-auto mb-2 opacity-50' />
            <p>
              {showLapsedOnly
                ? t('No lapsed members')
                : t('No active subscribers yet')}
            </p>
          </div>
        )}
        {subscribers.length > 0 && (
          <div className='space-y-2'>
            {subscribers.map(subscriber => (
              <div
                key={subscriber.id}
                className='flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors'
              >
                {subscriber.userAvatarUrl
                  ? (
                    <img
                      src={subscriber.userAvatarUrl}
                      alt={subscriber.userName}
                      className='w-8 h-8 rounded-full object-cover'
                    />
                    )
                  : (
                    <div className='w-8 h-8 rounded-full bg-foreground/20 flex items-center justify-center'>
                      <Users className='w-4 h-4 text-foreground/50' />
                    </div>
                    )}
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-foreground truncate'>
                    {subscriber.userName}
                  </p>
                  <p className='text-xs text-foreground/50'>
                    {subscriber.status === 'active'
                      ? t('Active')
                      : t('Lapsed')}
                    {subscriber.joinedAt && (
                      <span className='ml-2'>
                        {t('Joined')}: {new Date(subscriber.joinedAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
                {subscriber.status === 'lapsed' && subscriber.expiresAt && (
                  <span className='text-xs text-foreground/40'>
                    {t('Expired')}: {new Date(subscriber.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {subscribersMeta.totalPages > 1 && (
          <div className='flex items-center justify-center gap-2 mt-4'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handlePageChange(subscribersPage - 1)}
              disabled={subscribersPage <= 1}
            >
              {t('Previous')}
            </Button>
            <span className='text-sm text-foreground/70'>
              {t('Page')} {subscribersPage} {t('of')} {subscribersMeta.totalPages}
            </span>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handlePageChange(subscribersPage + 1)}
              disabled={!subscribersMeta.hasMore}
            >
              {t('Next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * List item displaying a single offering with details
 * Used in the OfferingsTab list view
 */
function OfferingListItem ({ offering, onEdit, group, isEditing, isExpanded, onToggleSubscribers, t }) {
  const [copied, setCopied] = useState(false)

  /**
   * Handle toggle click for subscriber view
   */
  const handleToggleClick = useCallback(() => {
    if (onToggleSubscribers) {
      onToggleSubscribers(offering.id)
    }
  }, [onToggleSubscribers, offering.id])
  const fullOfferingUrl = origin() + offeringUrl(offering.id, group.slug)

  // Use tracks and roles relations from GraphQL, fallback to parsing accessGrants for backwards compatibility
  const accessGrants = useMemo(() => {
    return parseAccessGrants(offering.accessGrants)
  }, [offering.accessGrants])

  // Get track and role objects for display using relations
  const accessDetails = useMemo(() => {
    const details = {
      tracks: offering.tracks || [],
      roles: offering.roles || [],
      hasGroups: false
    }

    // Since we only allow the current group, just check if groups exist
    if (accessGrants.groupIds && Array.isArray(accessGrants.groupIds) && accessGrants.groupIds.length > 0) {
      details.hasGroups = true
    }

    return details
  }, [offering.tracks, offering.roles, accessGrants])

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
            }`}
            >
              {offering.publishStatus === 'published'
                ? t('Published')
                : offering.publishStatus === 'unlisted'
                  ? t('Unlisted')
                  : offering.publishStatus === 'archived'
                    ? t('Archived')
                    : t('Unpublished')}
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
              <span>
                {t('Duration')}: {offering.duration === 'day'
                  ? t('1 Day')
                  : offering.duration === 'month'
                    ? t('1 Month')
                    : offering.duration === 'season'
                      ? t('1 Season')
                      : offering.duration === 'annual'
                        ? t('1 Year')
                        : offering.duration}
              </span>
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
        <div className='flex items-center gap-2 ml-4'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleToggleClick}
            className='flex items-center gap-1'
            title={t('View subscribed users')}
          >
            <Users className='w-4 h-4' />
            {isExpanded ? <ChevronUp className='w-3 h-3' /> : <ChevronDown className='w-3 h-3' />}
          </Button>
          <CopyToClipboard
            text={fullOfferingUrl}
            onCopy={() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            <Button
              variant='outline'
              size='sm'
              className='flex items-center gap-1'
              title={copied ? t('Copied!') : t('Copy Link')}
            >
              <Link2 className='w-4 h-4' />
              {copied ? t('Copied!') : t('Link')}
            </Button>
          </CopyToClipboard>
          {onEdit && (
            <Button
              variant='outline'
              size='sm'
              onClick={() => !isEditing && onEdit(offering)}
              disabled={isEditing}
            >
              <Edit className='w-4 h-4 mr-1' />
              {isEditing ? t('Editing...') : t('Edit')}
            </Button>
          )}
        </div>
      </div>

      {/* Subscribers Panel - shown when expanded */}
      {isExpanded && (
        <div className='mt-4 pt-4 border-t border-foreground/20'>
          <SubscribersPanel
            offering={offering}
            group={group}
            t={t}
          />
        </div>
      )}
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

export default OfferingsTab
