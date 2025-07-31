/* eslint-disable no-trailing-spaces, eol-last, indent */
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { Shield, Users, UserPlus, Clock, User } from 'lucide-react'

import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getCommonRoles from 'store/selectors/getCommonRoles'
import getMe from 'store/selectors/getMe'
import useRouteParams from 'hooks/useRouteParams'
import { cn } from 'util/index'
import VolunteerModal from 'components/VolunteerModal/VolunteerModal'
import TrustSlider from 'components/TrustSlider/TrustSlider'
import { removeRoleFromMember } from 'store/actions/roles'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'

export default function RolesPanel () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const commonRoles = useSelector(getCommonRoles)
  const currentUser = useSelector(getMe)

  const [volunteerModal, setVolunteerModal] = useState({ isOpen: false, role: null })
  const [rolesData, setRolesData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Get all roles: both group-specific roles and common roles enabled for this group
  const groupRoles = group?.groupRoles?.items || []
  
  // Get ALL common roles available to the group (like RolesSettingsTab does)
  // In leaderless groups, all common roles can potentially use trust assignment
  // Filter out common roles that already have corresponding GroupRole entries (auto-created)
  const groupRoleNames = new Set(groupRoles.map(role => role.name))
  const availableCommonRoles = commonRoles
    .filter(commonRole => !groupRoleNames.has(commonRole.name))
    .map(commonRole => ({
      ...commonRole,
      isCommonRole: true,
      // Set values for trust system fields based on group mode
      assignment: group?.mode === 'self_stewarded' ? 'trust' : 'admin',
      status: 'vacant' // Default to vacant, will be updated if people have the role
    }))

  // Combine all roles
  const allRoles = [...groupRoles, ...availableCommonRoles]

  // Debug: Log everything about the group and roles
  console.log('🔍 DEBUG GROUP DETAILED:', {
    groupId: group?.id,
    groupName: group?.name,
    groupMode: group?.mode,
    rawGroupRoles: group?.groupRoles,
    groupRolesItems: group?.groupRoles?.items,
    groupRolesCount: groupRoles.length,
    groupRolesList: groupRoles.map(r => ({ id: r.id, name: r.name, assignment: r.assignment })),
    
    allCommonRoles: commonRoles.length,
    commonRolesList: commonRoles.map(r => ({ id: r.id, name: r.name })),
    
    groupStewards: group?.stewards?.items?.length || 0,
    stewardCommonRoles: group?.stewards?.items?.map(s => s.membershipCommonRoles?.items) || [],
    
    availableCommonRolesCount: availableCommonRoles.length,
    availableCommonRolesList: availableCommonRoles.map(r => ({ id: r.id, name: r.name })),
    
    totalRolesCount: allRoles.length,
    finalRolesList: allRoles.map(r => ({
      id: r.id,
      name: r.name,
      active: r.active,
      assignment: r.assignment,
      status: r.status,
      isCommonRole: r.isCommonRole || false
    }))
  })

  useEffect(() => {
    if (group?.id && allRoles.length > 0) {
      fetchRolesWithTrustData()
    } else if (group?.id) {
      console.log('🟡 No roles found or group not loaded yet')
      setLoading(false)
    }
  }, [group?.id, allRoles.length])

  const fetchRolesWithTrustData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Debug: Log all roles and their assignments
      console.log('All roles:', allRoles.map(r => ({ id: r.id, name: r.name, assignment: r.assignment, status: r.status, isCommonRole: r.isCommonRole })))
      console.log('Group mode:', group?.mode)
      
      // For leaderless groups, all roles can use trust data
      // For admin groups, only trust-assigned roles use trust data
      const rolesNeedingTrustData = group?.mode === 'self_stewarded' 
        ? allRoles 
        : allRoles.filter(role => role.assignment === 'trust')
      
      console.log('Roles needing trust data:', rolesNeedingTrustData.map(r => ({ id: r.id, name: r.name, assignment: r.assignment, isCommonRole: r.isCommonRole })))
      
      if (rolesNeedingTrustData.length === 0) {
        console.log('No roles need trust data, showing basic role info')
        setRolesData(allRoles.map(role => ({
          ...role,
          candidates: [],
          trustExpressions: [],
          myTrustExpressions: {},
          trustEnabled: false
        })))
        setLoading(false)
        return
      }
      
      // Fetch trust data for roles that need it
      const rolePromises = allRoles.map(async role => {
        const needsTrustData = rolesNeedingTrustData.some(r => r.id === role.id)
        
        if (!needsTrustData) {
          return {
            ...role,
            candidates: [],
            trustExpressions: [],
            myTrustExpressions: {},
            trustEnabled: false
          }
        }
        
        // Fetch candidates and trust data for this role
        const url = role.isCommonRole 
          ? `/noo/role/${role.id}/trust-data?groupId=${group.id}`
          : `/noo/role/${role.id}/trust-data`
        
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch trust data for role ${role.name}`)
        }
        const trustData = await response.json()
        return {
          ...role,
          candidates: trustData.candidates || [],
          trustExpressions: trustData.trustExpressions || [],
          myTrustExpressions: trustData.myTrustExpressions || {},
          trustEnabled: true
        }
      })
      
      const rolesWithTrustData = await Promise.all(rolePromises)
      setRolesData(rolesWithTrustData)
    } catch (err) {
      console.error('Failed to fetch trust data:', err)
      setError(t('Failed to load role data. Please try again.'))
      // Fallback to basic role data
      setRolesData(allRoles.map(role => ({
        ...role,
        candidates: [],
        trustExpressions: [],
        myTrustExpressions: {},
        trustEnabled: false
      })))
    } finally {
      setLoading(false)
    }
  }

  const handleVolunteer = async (roleId, message = '') => {
    try {
      // Find the role to check if it's a common role
      const role = allRoles.find(r => r.id === roleId)
      const requestBody = { message }
      
      // Add groupId for common roles
      if (role && role.isCommonRole) {
        requestBody.groupId = group.id
      }
      
      const response = await fetch(`/noo/role/${roleId}/volunteer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      if (!response.ok) {
        throw new Error('Failed to volunteer')
      }
      // Refresh trust data and group cache after volunteering
      await fetchRolesWithTrustData()
      dispatch(fetchForGroup(group.slug))
      dispatch(fetchForCurrentUser())
    } catch (err) {
      console.error('Failed to volunteer:', err)
      setError(t('Failed to volunteer for role. Please try again.'))
    }
  }

  const handleNominate = async (roleId, userId, message = '') => {
    try {
      const response = await fetch(`/noo/role/${roleId}/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustee_id: userId, message })
      })
      if (!response.ok) {
        throw new Error('Failed to nominate')
      }
      // Refresh trust data and group cache after nominating
      await fetchRolesWithTrustData()
      dispatch(fetchForGroup(group.slug))
      dispatch(fetchForCurrentUser())
    } catch (err) {
      console.error('Failed to nominate:', err)
      setError(t('Failed to nominate member. Please try again.'))
    }
  }

  const handleTrust = async (roleId, trusteeId, value) => {
    try {
      // Find the role to check if it's a common role
      const role = allRoles.find(r => r.id === roleId)
      
      // Convert decimal values to integers for database compatibility
      // Trust system expects: 0 = no trust, 1 = full trust
      const integerValue = value >= 0.5 ? 1 : 0
      
      const requestBody = { trustee_id: trusteeId, value: integerValue }
      
      // Add groupId for common roles
      if (role && role.isCommonRole) {
        requestBody.groupId = group.id
      }
      
      const response = await fetch(`/noo/role/${roleId}/trust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      if (!response.ok) {
        throw new Error('Failed to express trust')
      }
      // Refresh trust data and group cache after trust expression
      await fetchRolesWithTrustData()
      dispatch(fetchForGroup(group.slug))
      dispatch(fetchForCurrentUser())
    } catch (err) {
      console.error('Failed to express trust:', err)
      setError(t('Failed to update trust level. Please try again.'))
    }
  }

  const handleResign = async (roleId) => {
    try {
      // Find the role to check if it's a common role
      const role = allRoles.find(r => r.id === roleId)
      const isCommonRole = role && role.isCommonRole
      
      // Use the standard removeRoleFromMember action like RolesSettingsTab does
      await dispatch(removeRoleFromMember({
        personId: currentUser.id,
        groupId: group.id,
        roleId: roleId,
        isCommonRole: isCommonRole
      }))
      
      // Refresh trust data after resignation
      await fetchRolesWithTrustData()
      dispatch(fetchForGroup(group.slug))
      dispatch(fetchForCurrentUser())
    } catch (err) {
      console.error('Failed to resign from role:', err)
      setError(t('Failed to resign from role. Please try again.'))
    }
  }

  const openVolunteerModal = (role) => {
    setVolunteerModal({ isOpen: true, role })
  }

  const closeVolunteerModal = () => {
    setVolunteerModal({ isOpen: false, role: null })
  }

  if (!group) {
    return <div className='p-4'>Loading group...</div>
  }

  if (group.mode !== 'self_stewarded') {
    return <div className='p-4'>This group is not self-stewarded.</div>
  }

  if (loading) {
    return (
      <div className='p-4'>
        <div className='animate-pulse'>
          <div className='h-4 bg-gray-200 rounded w-1/4 mb-4' />
          <div className='space-y-3'>
            <div className='h-20 bg-gray-200 rounded' />
            <div className='h-20 bg-gray-200 rounded' />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-3xl mx-auto px-4 py-6'>
      <div className='space-y-6'>
        <div>
          <div className='flex items-center gap-2 text-lg font-semibold text-foreground mb-2'>
            <Shield className='w-5 h-5' />
            {group?.mode === 'self_stewarded' ? t('Role Stewardship') : t('Roles')}
          </div>
          <div className='text-sm text-foreground/50'>
            {group?.mode === 'self_stewarded' ? t('Members volunteer and earn trust to steward roles in this group.') : t('Group roles and their current holders.')}
          </div>
        </div>

        {error && (
          <div className='bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm'>
            {error}
            <button
              onClick={() => setError(null)}
              className='ml-2 text-red-500 hover:text-red-700 underline'
            >
              {t('Dismiss')}
            </button>
          </div>
        )}

        {rolesData.length === 0
          ? (
            <div className='text-center py-8 text-foreground/60'>
              <Shield className='w-12 h-12 mx-auto mb-2 opacity-50' />
              <p>{t('No roles configured yet.')}</p>
              <p className='text-sm mt-2'>
                {t('Go to')} <a href={`/groups/${group.slug}/settings/roles`} className='text-blue-500 hover:underline'>{t('Group Settings > Roles & Badges')}</a> {t('to create roles for this group.')}
              </p>
            </div>
          )
          : (
            <div className='space-y-6'>
              {rolesData.map(role => (
                              <RoleCard
                key={role.id}
                role={role}
                currentUser={currentUser}
                onVolunteer={openVolunteerModal}
                onTrust={handleTrust}
                onResign={handleResign}
              />
              ))}

              <VolunteerModal
                role={volunteerModal.role}
                isOpen={volunteerModal.isOpen}
                onClose={closeVolunteerModal}
                onVolunteer={handleVolunteer}
                onNominate={handleNominate}
              />
            </div>
          )}
      </div>
    </div>
  )
}

function RoleCard ({ role, currentUser, onVolunteer, onTrust, onResign }) {
  const { t } = useTranslation()

  const status = role.status || 'vacant'
  const candidates = role.candidates || []
  const stewards = role.stewards?.items || []
  const myTrustExpressions = role.myTrustExpressions || {}
  const trustEnabled = role.trustEnabled !== false // Default to true for backward compatibility

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <Shield className='w-4 h-4 text-green-500' />
      case 'pending':
        return <Clock className='w-4 h-4 text-yellow-500' />
      case 'vacant':
        return <Users className='w-4 h-4 text-gray-500' />
      case 'contested':
        return <Shield className='w-4 h-4 text-orange-500' />
      default:
        return <Shield className='w-4 h-4 text-blue-500' />
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return t('Active')
      case 'pending':
        return t('Pending')
      case 'vacant':
        return t('Vacant')
      case 'contested':
        return t('Contested')
      default:
        return t('Available')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'vacant':
        return 'bg-gray-100 text-gray-800'
      case 'contested':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  return (
    <div className='bg-black/20 rounded-lg p-6 border border-foreground/10'>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-3'>
          {getStatusIcon(status)}
          <h3 className='text-lg font-medium text-foreground'>{role.name}</h3>
          {!trustEnabled && (
            <span className='text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full'>
              {role.assignment === 'admin' ? t('Admin Assigned') : t('Traditional')}
            </span>
          )}
        </div>
        <span className={cn('text-xs px-3 py-1 rounded-full font-medium', getStatusColor(status))}>
          {getStatusText(status)}
        </span>
      </div>

      {role.description && (
        <p className='text-sm text-foreground/50 mb-4'>{role.description}</p>
      )}

      {/* Trust Progress indicator removed */}

      {/* Current Stewards */}
      {stewards.length > 0 && (
        <div className='mb-6'>
          <label className='text-sm text-foreground/50 block mb-3'>
            {trustEnabled ? t('Current Stewards') : t('Role Holders')}
          </label>
          {trustEnabled
            ? (
              <div className='space-y-3'>
                {stewards.map(steward => (
                                  <VolunteerCard
                  key={steward.id}
                  candidate={steward}
                  role={role}
                  currentUser={currentUser}
                  myTrustValue={myTrustExpressions[steward.id] || 0}
                  onTrust={onTrust}
                  onResign={onResign}
                  isSteward
                />
                ))}
              </div>
            )
            : (
              <div className='flex flex-wrap gap-2'>
                {stewards.map(steward => (
                  <div key={steward.id} className='flex items-center gap-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs'>
                    <User className='w-3 h-3' />
                    {steward.name}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Candidates/Volunteers - only for trust-enabled roles */}
      {trustEnabled && candidates.length > 0 && (
        <div className='mb-6'>
          <label className='text-sm text-foreground/50 block mb-3'>
            {t('Volunteers')} ({candidates.length})
          </label>
          <div className='space-y-3'>
            {candidates.map(candidate => (
              <VolunteerCard
                key={candidate.id}
                candidate={candidate}
                role={role}
                currentUser={currentUser}
                myTrustValue={myTrustExpressions[candidate.id] || 0}
                onTrust={onTrust}
                onResign={onResign}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {trustEnabled && (() => {
        // Check if current user is already a steward
        const isCurrentSteward = stewards.some(steward => steward.id === currentUser?.id)
        // Check if current user is already a volunteer 
        const isCurrentVolunteer = candidates.some(candidate => candidate.id === currentUser?.id)
        // Only show volunteer button if user is neither steward nor volunteer
        const canVolunteer = !isCurrentSteward && !isCurrentVolunteer
        
        return canVolunteer && (
          <div className='flex gap-3 pt-4'>
            <button
              onClick={() => onVolunteer(role)}
              className='flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium'
            >
              <UserPlus className='w-4 h-4' />
              {t('Volunteer to steward this role')}
            </button>
          </div>
        )
      })()}

      {/* Non-trust role info */}
      {!trustEnabled && (
        <div className='text-sm text-foreground/60'>
          {role.assignment === 'admin' && t('This role is assigned by group administrators.')}
          {!role.assignment && t('This role uses traditional assignment.')}
        </div>
      )}
    </div>
  )
}

function VolunteerCard ({ candidate, role, currentUser, myTrustValue, onTrust, onResign, isSteward = false }) {
  const { t } = useTranslation()
  const [trustValue, setTrustValue] = useState(myTrustValue)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setTrustValue(myTrustValue)
  }, [myTrustValue])

  const handleTrustChange = async (newValue) => {
    if (isUpdating || candidate.id === currentUser?.id) return
    
    setIsUpdating(true)
    try {
      await onTrust(role.id, candidate.id, newValue)
      setTrustValue(newValue)
    } catch (err) {
      console.error('Failed to update trust:', err)
      // Revert to previous value on error
      setTrustValue(myTrustValue)
    } finally {
      setIsUpdating(false)
    }
  }

  const isOwnCandidate = candidate.id === currentUser?.id

  return (
    <div className={cn(
      'rounded-lg p-4 border',
      isSteward 
        ? 'border-selected bg-green-500/10'
        : 'border-foreground/20 bg-black/20'
    )}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-3'>
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            isSteward ? 'bg-green-500' : 'bg-blue-500'
          )}>
            <span className='text-white text-sm font-bold'>
              {candidate.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <div className='flex items-center gap-2'>
              <span className='text-sm font-medium text-foreground'>
                {candidate.name}
              </span>
              {isSteward && (
                <span className='text-xs bg-green-500/20 text-green-700 px-2 py-1 rounded-full font-medium'>
                  {t('Steward')}
                </span>
              )}
              {isOwnCandidate && (
                <span className='text-xs text-blue-500 font-medium'>({t('You')})</span>
              )}
            </div>
          </div>
        </div>
        
        {candidate.trustScore && (
          <div className='text-xs text-foreground/60'>
            {t('Trust')}: {candidate.trustScore}/{role.thresholdRequired || role.threshold_required}
          </div>
        )}
      </div>
      
      {!isOwnCandidate && (
        <div className='mt-3'>
          <TrustSlider
            value={trustValue}
            onChange={handleTrustChange}
            disabled={isUpdating}
            label={t('Your trust level')}
          />
        </div>
      )}
      
      {isOwnCandidate && isSteward && (
        <div className='mt-3 pt-3 border-t border-foreground/10'>
          <button
            onClick={() => onResign(role.id)}
            className='flex items-center gap-2 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium'
          >
            {t('Resign from this role')}
          </button>
        </div>
      )}
      
      {isOwnCandidate && !isSteward && (
        <div className='text-xs text-foreground/50 mt-3'>
          {t('You cannot vote for yourself')}
        </div>
      )}
    </div>
  )
} 