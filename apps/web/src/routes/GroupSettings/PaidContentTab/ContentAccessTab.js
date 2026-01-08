/**
 * ContentAccessTab Components
 *
 * Contains components for viewing and managing content access records:
 * - ContentAccessTab: Main tab with filters and list
 * - ContentAccessRecordItem: Individual record display
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { List, UserPlus, User, MoreVertical, Ban } from 'lucide-react'

import Loading from 'components/Loading'
import ItemSelector from 'components/ItemSelector'
import SettingsSection from '../SettingsSection'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'components/ui/dialog'

import { fetchContentAccess, getContentAccessRecords } from './PaidContentTab.store'
import fetchGroupTracks from 'store/actions/fetchGroupTracks'
import fetchPeopleAutocomplete from 'store/actions/fetchPeopleAutocomplete'
import grantContentAccess from 'store/actions/grantContentAccess'
import revokeContentAccess from 'store/actions/revokeContentAccess'
// TODO: Re-enable when refund functionality is ready
// import refundContentAccess from 'store/actions/refundContentAccess'
import getTracksForGroup from 'store/selectors/getTracksForGroup'
import useDebounce from 'hooks/useDebounce'
import getCommonRoles from 'store/selectors/getCommonRoles'

/**
 * Content Access Tab Component
 *
 * Displays and manages content access records for the group
 */
function ContentAccessTab ({ group, offerings = [] }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const tracks = useSelector(state => getTracksForGroup(state, { groupId: group?.id }))
  const commonRoles = useSelector(getCommonRoles)
  const contentAccessData = useSelector(getContentAccessRecords)

  const [search, setSearch] = useState('')
  const [accessTypeFilter, setAccessTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [offeringFilter, setOfferingFilter] = useState('all')
  const [trackFilter, setTrackFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showGrantForm, setShowGrantForm] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const { items: contentAccessRecords = [], total = 0, hasMore = false } = contentAccessData

  // Function to fetch content access records
  const fetchContentAccessRecords = useCallback(() => {
    if (!group?.id) return

    setLoading(true)
    const params = {
      groupIds: [group.id],
      search: debouncedSearch || undefined,
      accessType: accessTypeFilter !== 'all' ? accessTypeFilter : null,
      status: statusFilter !== 'all' ? statusFilter : null,
      offeringId: offeringFilter !== 'all' ? offeringFilter : null,
      trackId: trackFilter !== 'all' ? trackFilter : null,
      roleId: roleFilter !== 'all' ? roleFilter : null,
      first: 20,
      offset,
      sortBy: 'created_at',
      order: 'desc'
    }

    dispatch(fetchContentAccess(params))
      .finally(() => setLoading(false))
  }, [dispatch, group?.id, debouncedSearch, accessTypeFilter, statusFilter, offeringFilter, trackFilter, roleFilter, offset])

  // Initial load on mount
  useEffect(() => {
    fetchContentAccessRecords()
  }, [fetchContentAccessRecords])

  // Fetch tracks when needed
  useEffect(() => {
    if (group?.id) {
      dispatch(fetchGroupTracks(group.id, { published: true }))
    }
  }, [dispatch, group?.id])

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0)
  }, [debouncedSearch, accessTypeFilter, statusFilter, offeringFilter, trackFilter, roleFilter])

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setOffset(offset + 20)
    }
  }

  return (
    <SettingsSection>
      <div className='flex flex-col gap-4'>
        {/* Header with Toggle */}
        <div className='bg-card p-4 rounded-md text-foreground shadow-md'>
          <div className='flex items-center justify-between mb-1'>
            <h3 className='text-lg font-semibold'>
              {showGrantForm ? t('Grant Access') : t('Content Access Records')}
            </h3>
            <button
              onClick={() => setShowGrantForm(!showGrantForm)}
              className='flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm hover:opacity-90 transition-opacity'
            >
              {showGrantForm
                ? (
                  <>
                    <List className='w-4 h-4' />
                    {t('View Records')}
                  </>
                  )
                : (
                  <>
                    <UserPlus className='w-4 h-4' />
                    {t('Grant Access')}
                  </>
                  )}
            </button>
          </div>
          <p className='text-sm text-foreground/70'>
            {showGrantForm
              ? t('Grant users access to group content, tracks, or offerings')
              : t('View and manage all content access grants for your group')}
          </p>
        </div>

        {showGrantForm
          ? (
            <GrantAccessForm
              group={group}
              offerings={offerings}
              tracks={tracks}
              onSuccess={() => {
                setShowGrantForm(false)
                fetchContentAccessRecords()
              }}
              onCancel={() => setShowGrantForm(false)}
            />
            )
          : (
            <>
              {/* Search and Filters */}
              <div className='bg-card p-4 rounded-md shadow-md'>
                {/* Search Input */}
                <div className='mb-4'>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    {t('Search by member name')}
                  </label>
                  <input
                    type='text'
                    className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground placeholder-foreground/50 focus:border-focus focus:outline-none'
                    placeholder={t('Type member name...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Filter Dropdowns */}
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {/* Access Type Filter */}
                  <div>
                    <label className='block text-sm font-medium text-foreground mb-2'>
                      {t('Access Type')}
                    </label>
                    <select
                      className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
                      value={accessTypeFilter}
                      onChange={(e) => setAccessTypeFilter(e.target.value)}
                    >
                      <option value='all'>{t('All Types')}</option>
                      <option value='stripe_purchase'>{t('Stripe Purchase')}</option>
                      <option value='admin_grant'>{t('Admin Grant')}</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className='block text-sm font-medium text-foreground mb-2'>
                      {t('Status')}
                    </label>
                    <select
                      className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value='all'>{t('All Status')}</option>
                      <option value='active'>{t('Active')}</option>
                      <option value='expired'>{t('Expired')}</option>
                      <option value='revoked'>{t('Revoked')}</option>
                    </select>
                  </div>

                  {/* Offering Filter */}
                  <div>
                    <label className='block text-sm font-medium text-foreground mb-2'>
                      {t('Offering')}
                    </label>
                    <select
                      className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
                      value={offeringFilter}
                      onChange={(e) => setOfferingFilter(e.target.value)}
                      disabled={!offerings || offerings.length === 0}
                    >
                      <option value='all'>
                        {offerings && offerings.length > 0 ? t('All Offerings') : t('No offerings available')}
                      </option>
                      {offerings && offerings.map(offering => (
                        <option key={offering.id} value={offering.id}>
                          {offering.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Track Filter */}
                  <div>
                    <label className='block text-sm font-medium text-foreground mb-2'>
                      {t('Track')}
                    </label>
                    <select
                      className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
                      value={trackFilter}
                      onChange={(e) => setTrackFilter(e.target.value)}
                    >
                      <option value='all'>{t('All Tracks')}</option>
                      {tracks?.map(track => (
                        <option key={track.id} value={track.id}>
                          {track.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Role Filter */}
                  <div>
                    <label className='block text-sm font-medium text-foreground mb-2'>
                      {t('Role')}
                    </label>
                    <select
                      className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      <option value='all'>{t('All Roles')}</option>
                      {commonRoles?.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.emoji} {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Results Count */}
              <div className='text-sm text-foreground/70'>
                {t('Showing {{count}} of {{total}} records', { count: contentAccessRecords.length, total })}
              </div>

              {/* Content Access List */}
              {loading && contentAccessRecords.length === 0 && <Loading />}
              {!loading && contentAccessRecords.length === 0 && (
                <div className='bg-card p-8 rounded-md shadow-md text-center text-foreground/70'>
                  <p>{t('No content access records found')}</p>
                </div>
              )}
              {contentAccessRecords.length > 0 && (
                <div className='flex flex-col gap-2'>
                  {contentAccessRecords.map(record => (
                    <ContentAccessRecordItem
                      key={record.id}
                      record={record}
                      t={t}
                      onActionComplete={fetchContentAccessRecords}
                    />
                  ))}
                </div>
              )}

              {/* Load More Button */}
              {hasMore && (
                <div className='flex justify-center mt-4'>
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className='px-6 py-2 bg-accent text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50'
                  >
                    {loading ? t('Loading...') : t('Load More')}
                  </button>
                </div>
              )}
            </>
            )}
      </div>
    </SettingsSection>
  )
}

/**
 * Content Access Record Item Component
 *
 * Displays a single content access record with action menu
 */
function ContentAccessRecordItem ({ record, t, onActionComplete }) {
  const dispatch = useDispatch()
  const { id, user, offering, track, role, accessType, status, createdAt, expiresAt, grantedBy, subscriptionCancelAtPeriodEnd, subscriptionPeriodEnd } = record

  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  // TODO: Re-enable when refund functionality is ready
  // const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const isActive = status === 'active'
  // TODO: Re-enable when refund functionality is ready
  // const isPurchase = accessType === 'stripe_purchase'

  const getAccessTypeBadge = (type) => {
    if (type === 'stripe_purchase') {
      return <span className='px-2 py-1 text-xs rounded bg-accent/20 text-accent'>{t('Purchased')}</span>
    }
    return <span className='px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400'>{t('Admin Grant')}</span>
  }

  const getStatusBadge = (statusValue, isCancelling) => {
    if (isCancelling) {
      return <span className='px-2 py-1 text-xs rounded bg-orange-500/20 text-orange-400'>{t('Cancelling')}</span>
    }
    if (statusValue === 'active') {
      return <span className='px-2 py-1 text-xs rounded bg-green-500/20 text-green-400'>{t('Active')}</span>
    }
    if (statusValue === 'expired') {
      return <span className='px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-400'>{t('Expired')}</span>
    }
    return <span className='px-2 py-1 text-xs rounded bg-red-500/20 text-red-400'>{t('Revoked')}</span>
  }

  const formatDate = (dateString) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString()
  }

  const handleRevoke = async () => {
    setIsProcessing(true)
    try {
      await dispatch(revokeContentAccess({ accessId: id, reason: 'Revoked by admin' }))
      setShowRevokeDialog(false)
      if (onActionComplete) onActionComplete()
    } catch (error) {
      console.error('Failed to revoke access:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // TODO: Re-enable when refund functionality is ready
  // const handleRefund = async () => {
  //   setIsProcessing(true)
  //   try {
  //     await dispatch(refundContentAccess({ accessId: id, reason: 'Refunded by admin' }))
  //     setShowRefundDialog(false)
  //     if (onActionComplete) onActionComplete()
  //   } catch (error) {
  //     console.error('Failed to refund access:', error)
  //   } finally {
  //     setIsProcessing(false)
  //   }
  // }

  return (
    <>
      <div className='bg-card p-4 rounded-md shadow-md hover:shadow-lg transition-shadow'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          {/* User Info */}
          <div className='flex items-center gap-3 flex-1'>
            {user?.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className='w-10 h-10 rounded-full'
              />
            )}
            <div>
              <div className='font-medium text-foreground'>{user?.name}</div>
              <div className='text-sm text-foreground/70'>
                {offering && <span>{offering.name}</span>}
                {track && <span> • {track.name}</span>}
                {role && <span> • {role.emoji} {role.name}</span>}
              </div>
            </div>
          </div>

          {/* Badges and Info */}
          <div className='flex flex-wrap items-center gap-2'>
            {getAccessTypeBadge(accessType)}
            {getStatusBadge(status, subscriptionCancelAtPeriodEnd)}
            <div className='text-xs text-foreground/60'>
              {t('Granted')}: {formatDate(createdAt)}
            </div>
            {subscriptionCancelAtPeriodEnd && subscriptionPeriodEnd && (
              <div className='text-xs text-orange-400'>
                {t('Cancels')}: {formatDate(subscriptionPeriodEnd)}
              </div>
            )}
            {!subscriptionCancelAtPeriodEnd && expiresAt && (
              <div className='text-xs text-foreground/60'>
                {t('Expires')}: {formatDate(expiresAt)}
              </div>
            )}

            {/* Action Menu */}
            {isActive && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className='p-1 rounded-md hover:bg-foreground/10 transition-colors'>
                    <MoreVertical className='w-4 h-4 text-foreground/60' />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem
                    onClick={() => setShowRevokeDialog(true)}
                    className='cursor-pointer text-red-500 focus:text-red-500'
                  >
                    <Ban className='w-4 h-4 mr-2' />
                    {t('Revoke Access')}
                  </DropdownMenuItem>
                  {/* TODO: Add refund functionality later
                  {isPurchase && (
                    <DropdownMenuItem
                      onClick={() => setShowRefundDialog(true)}
                      className='cursor-pointer text-orange-500 focus:text-orange-500'
                    >
                      <RefreshCcw className='w-4 h-4 mr-2' />
                      {t('Refund')}
                    </DropdownMenuItem>
                  )}
                  */}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Granted By Info */}
        {grantedBy && (
          <div className='mt-2 text-xs text-foreground/60'>
            {t('Granted by')}: {grantedBy.name}
          </div>
        )}
      </div>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Revoke Access')}</DialogTitle>
            <DialogDescription>
              {t('This will immediately revoke access for {{userName}}. Any active subscription will be cancelled, but no refund will be issued.', { userName: user?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowRevokeDialog(false)}
              disabled={isProcessing}
              className='px-4 py-2 bg-foreground/10 text-foreground rounded-md hover:bg-foreground/20 transition-colors disabled:opacity-50'
            >
              {t('Cancel')}
            </button>
            <button
              onClick={handleRevoke}
              disabled={isProcessing}
              className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50'
            >
              {isProcessing ? t('Revoking...') : t('Revoke Access')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TODO: Re-enable Refund Dialog when functionality is ready
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Refund Purchase')}</DialogTitle>
            <DialogDescription>
              {t('This will revoke access for {{userName}}, cancel any active subscription, and issue a refund for the most recent payment. This action cannot be undone.', { userName: user?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowRefundDialog(false)}
              disabled={isProcessing}
              className='px-4 py-2 bg-foreground/10 text-foreground rounded-md hover:bg-foreground/20 transition-colors disabled:opacity-50'
            >
              {t('Cancel')}
            </button>
            <button
              onClick={handleRefund}
              disabled={isProcessing}
              className='px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50'
            >
              {isProcessing ? t('Processing...') : t('Refund')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      */}
    </>
  )
}

/**
 * Grant Access Form Component
 *
 * Form for admins to grant access to users
 */
function GrantAccessForm ({ group, offerings, tracks, onSuccess, onCancel }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [selectedUser, setSelectedUser] = useState(null)
  const [accessType, setAccessType] = useState('') // 'offering', 'group', or 'track'
  const [selectedOfferingId, setSelectedOfferingId] = useState('')
  const [selectedTrackId, setSelectedTrackId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Handles user selection from ItemSelector
   */
  const handleUserSelect = useCallback((user) => {
    setSelectedUser(user)
    setError(null)
  }, [])

  /**
   * Checks if the form is valid for submission
   */
  const isFormValid = useCallback(() => {
    if (!selectedUser) return false
    if (!accessType) return false
    if (accessType === 'offering' && !selectedOfferingId) return false
    if (accessType === 'track' && !selectedTrackId) return false
    return true
  }, [selectedUser, accessType, selectedOfferingId, selectedTrackId])

  /**
   * Handles form submission
   */
  const handleSubmit = useCallback(async () => {
    if (!isFormValid()) {
      setError(t('Please select a user and an access type'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const params = {
        userId: selectedUser.id,
        grantedByGroupId: group.id,
        groupId: accessType === 'group' ? group.id : null,
        productId: accessType === 'offering' ? selectedOfferingId : null,
        trackId: accessType === 'track' ? selectedTrackId : null,
        reason: 'Admin grant via settings'
      }

      const result = await dispatch(grantContentAccess(params))

      if (result?.error || result?.payload?.errors) {
        const errorMessage = result?.payload?.errors?.[0]?.message || result?.error?.message || t('Failed to grant access')
        throw new Error(errorMessage)
      }

      onSuccess()
    } catch (err) {
      setError(err.message || t('Failed to grant access'))
    } finally {
      setSubmitting(false)
    }
  }, [dispatch, isFormValid, selectedUser, accessType, selectedOfferingId, selectedTrackId, group, onSuccess, t])

  return (
    <div className='bg-card p-4 rounded-md shadow-md'>
      <p className='text-foreground/70 mb-4'>
        {t('Select a user and choose what access to grant them.')}
      </p>

      {/* User Selection */}
      <div className='mb-4'>
        <label className='block text-sm font-medium text-foreground mb-2 flex items-center gap-2'>
          <User className='w-4 h-4' />
          {t('Select User')}
        </label>
        <ItemSelector
          selectedItem={selectedUser}
          onSelect={handleUserSelect}
          fetchItems={fetchPeopleAutocomplete}
          searchPlaceholder={t('Search for a user...')}
          emptyMessage={t('No users found')}
        />
      </div>

      {/* Access Type Selection */}
      <div className='mb-4'>
        <label className='block text-sm font-medium text-foreground mb-2'>
          {t('Access Type')}
        </label>
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={() => {
              setAccessType('offering')
              setSelectedTrackId('')
            }}
            className={`px-4 py-2 rounded-md border transition-colors ${
              accessType === 'offering'
                ? 'bg-accent text-white border-accent'
                : 'border-foreground/20 text-foreground hover:border-foreground/40'
            }`}
          >
            {t('Offering')}
          </button>
          <button
            type='button'
            onClick={() => {
              setAccessType('group')
              setSelectedOfferingId('')
              setSelectedTrackId('')
            }}
            className={`px-4 py-2 rounded-md border transition-colors ${
              accessType === 'group'
                ? 'bg-accent text-white border-accent'
                : 'border-foreground/20 text-foreground hover:border-foreground/40'
            }`}
          >
            {t('Group Access')}
          </button>
          <button
            type='button'
            onClick={() => {
              setAccessType('track')
              setSelectedOfferingId('')
            }}
            className={`px-4 py-2 rounded-md border transition-colors ${
              accessType === 'track'
                ? 'bg-accent text-white border-accent'
                : 'border-foreground/20 text-foreground hover:border-foreground/40'
            }`}
          >
            {t('Track')}
          </button>
        </div>
      </div>

      {/* Offering Selector - TODO: Implement in 8d */}
      {accessType === 'offering' && (
        <div className='mb-4'>
          <label className='block text-sm font-medium text-foreground mb-2'>
            {t('Select Offering')}
          </label>
          <select
            value={selectedOfferingId}
            onChange={(e) => setSelectedOfferingId(e.target.value)}
            className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
          >
            <option value=''>{t('Choose an offering...')}</option>
            {offerings?.map(offering => (
              <option key={offering.id} value={offering.id}>
                {offering.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Group Access Info */}
      {accessType === 'group' && (
        <div className='mb-4 p-3 bg-accent/10 rounded-md'>
          <p className='text-sm text-foreground'>
            {t('Granting group access will add the selected user as a member of this group.')}
          </p>
        </div>
      )}

      {/* Track Selector - TODO: Implement in 8e */}
      {accessType === 'track' && (
        <div className='mb-4'>
          <label className='block text-sm font-medium text-foreground mb-2'>
            {t('Select Track')}
          </label>
          <select
            value={selectedTrackId}
            onChange={(e) => setSelectedTrackId(e.target.value)}
            className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
          >
            <option value=''>{t('Choose a track...')}</option>
            {tracks?.map(track => (
              <option key={track.id} value={track.id}>
                {track.name} {track.accessControlled && `(${t('Access Controlled')})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className='mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md'>
          <p className='text-sm text-red-500'>{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className='flex justify-end gap-2 mt-4'>
        <button
          onClick={onCancel}
          disabled={submitting}
          className='px-4 py-2 rounded-md border border-foreground/20 text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50'
        >
          {t('Cancel')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isFormValid() || submitting}
          className='px-4 py-2 rounded-md bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50'
        >
          {submitting ? t('Granting...') : t('Grant Access')}
        </button>
      </div>
    </div>
  )
}

export default ContentAccessTab
