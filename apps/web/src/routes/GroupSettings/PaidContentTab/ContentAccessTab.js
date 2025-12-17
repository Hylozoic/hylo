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

import Loading from 'components/Loading'
import SettingsSection from '../SettingsSection'

import { fetchContentAccess, getContentAccessRecords } from './PaidContentTab.store'
import fetchGroupTracks from 'store/actions/fetchGroupTracks'
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
        {/* Header */}
        <div className='bg-card p-4 rounded-md text-foreground shadow-md'>
          <h3 className='text-lg font-semibold mb-1'>{t('Content Access Records')}</h3>
          <p className='text-sm text-foreground/70'>
            {t('View and manage all content access grants for your group')}
          </p>
        </div>

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
              <ContentAccessRecordItem key={record.id} record={record} t={t} />
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
      </div>
    </SettingsSection>
  )
}

/**
 * Content Access Record Item Component
 *
 * Displays a single content access record
 */
function ContentAccessRecordItem ({ record, t }) {
  const { user, offering, track, role, accessType, status, createdAt, expiresAt, grantedBy } = record

  const getAccessTypeBadge = (type) => {
    if (type === 'stripe_purchase') {
      return <span className='px-2 py-1 text-xs rounded bg-accent/20 text-accent'>{t('Purchased')}</span>
    }
    return <span className='px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400'>{t('Admin Grant')}</span>
  }

  const getStatusBadge = (statusValue) => {
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

  return (
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
          {getStatusBadge(status)}
          <div className='text-xs text-foreground/60'>
            {t('Granted')}: {formatDate(createdAt)}
          </div>
          {expiresAt && (
            <div className='text-xs text-foreground/60'>
              {t('Expires')}: {formatDate(expiresAt)}
            </div>
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
  )
}

export default ContentAccessTab

