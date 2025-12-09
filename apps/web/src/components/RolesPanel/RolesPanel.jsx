/* eslint-disable no-trailing-spaces, eol-last, indent */
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { Shield, UserPlus, X } from 'lucide-react'

import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getCommonRoles from 'store/selectors/getCommonRoles'
import getMe from 'store/selectors/getMe'
import useRouteParams from 'hooks/useRouteParams'
import { personUrl } from '@hylo/navigation'
import { cn } from 'util/index'
import VolunteerModal from 'components/VolunteerModal/VolunteerModal'
import TrustSlider from 'components/TrustSlider/TrustSlider'
import { removeRoleFromMember } from 'store/actions/roles'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import RoundImage from 'components/RoundImage'

const DEFAULT_ROLE_BANNER = '/default-group-banner.svg'

export default function RolesPanel () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const commonRoles = useSelector(getCommonRoles)
  const currentUser = useSelector(getMe)
  const groupSlug = group?.slug || routeParams.groupSlug

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
      assignment: group?.mode === 'member_led' ? 'trust' : 'admin',
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
      const rolesNeedingTrustData = group?.mode === 'member_led' 
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
          stewards: trustData.stewards || [],
          trustExpressions: trustData.trustExpressions || [],
          myTrustExpressions: trustData.myTrustExpressions || {},
          trustNetwork: trustData.trustNetwork || [],
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
      
      const requestBody = { trustee_id: trusteeId, value }
      
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

  const handleResign = async (roleId, { isSteward = false } = {}) => {
    try {
      // Find the role to check if it's a common role
      const role = allRoles.find(r => r.id === roleId)
      const isCommonRole = role && role.isCommonRole
      
      if (isSteward) {
        // Use the standard removeRoleFromMember action like RolesSettingsTab does
        await dispatch(removeRoleFromMember({
          personId: currentUser.id,
          groupId: group.id,
          roleId: roleId,
          isCommonRole: isCommonRole
        }))
      }

      const withdrawBody = role && role.isCommonRole ? { groupId: group.id } : null
      const withdrawResponse = await fetch(`/noo/role/${roleId}/volunteer`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: withdrawBody ? JSON.stringify(withdrawBody) : undefined
      })
      if (!withdrawResponse.ok) {
        throw new Error('Failed to withdraw volunteer status')
      }
      
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
            {group?.mode === 'member_led' ? t('Role Stewardship') : t('Roles')}
          </div>
          <div className='text-sm text-foreground/50'>
            {group?.mode === 'member_led' ? t('Members volunteer and earn trust to steward roles in this group.') : t('Group roles and their current holders.')}
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
                  groupSlug={groupSlug}
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

function RoleCard ({ role, currentUser, onVolunteer, onTrust, onResign, groupSlug }) {

  const { t } = useTranslation()



  const status = role.status || 'vacant'

  const candidates = role.candidates || []

  const stewards = role.stewards || []

  const myTrustExpressions = role.myTrustExpressions || {}

  const trustEnabled = role.trustEnabled !== false // Default to true for backward compatibility
  const getTrustDetails = (personId) => role.trustNetwork?.find(entry => entry.trusteeId === personId)
  const derivedStatus = stewards.length > 0
    ? 'active'
    : (candidates.length > 0 ? 'pending' : status)

  const isCurrentSteward = stewards.some(steward => steward.id === currentUser?.id)
  const isCurrentVolunteer = candidates.some(candidate => candidate.id === currentUser?.id)
  const canVolunteer = trustEnabled && !isCurrentSteward && !isCurrentVolunteer

  const renderVolunteerCTA = () => (
    <button
      type='button'
      onClick={() => onVolunteer(role)}
      className='relative w-[12.6rem] min-h-[14.7rem] rounded-2xl border-2 border-foreground/20 bg-transparent text-foreground/70 flex flex-col items-center justify-center gap-3 text-center px-4 py-6 transition-colors hover:border-foreground/100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/70'
    >
      <span className='inline-flex items-center justify-center w-12 h-12 rounded-2xl border border-foreground/20 text-foreground/80 bg-foreground/5'>
        <UserPlus className='w-5 h-5' />
      </span>
      <span className='text-sm font-medium leading-tight'>{t('Volunteer to steward this role')}</span>
    </button>
  )





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
        <h3 className='text-lg font-medium text-foreground flex items-center gap-2'>
          {role.emoji && (
            <span className='text-2xl leading-none'>{role.emoji}</span>
          )}
          {role.name}
        </h3>

          {!trustEnabled && (

            <span className='text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full'>

              {role.assignment === 'admin' ? t('Admin Assigned') : t('Traditional')}

            </span>

          )}

        </div>

        <span className={cn('text-xs px-3 py-1 rounded-full font-medium', getStatusColor(derivedStatus))}>

          {(candidates.length === 0 && stewards.length === 0)
            ? t('0 volunteers')
            : getStatusText(derivedStatus)}

        </span>

      </div>



      {role.description && (

        <p className='text-sm text-foreground/50 mb-4'>{role.description}</p>

      )}



      {/* Current Stewards */}

      {stewards.length > 0 && (
        <div className='mb-6'>
          <label className='text-sm text-foreground/50 block mb-3'>
            {trustEnabled ? t('Current Stewards') : t('Role Holders')}
          </label>
          <div className='flex flex-wrap gap-4'>
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
                trustDetails={getTrustDetails(steward.id)}
                groupSlug={groupSlug}
              />
            ))}
            {canVolunteer && candidates.length === 0 && renderVolunteerCTA()}
          </div>
        </div>
      )}



      {/* Candidates/Volunteers - only for trust-enabled roles */}

      {trustEnabled && candidates.length > 0 && (
        <div className='mb-6'>
          <label className='text-sm text-foreground/50 block mb-3'>
            {t('Volunteers')} ({candidates.length})
          </label>
          <div className='flex flex-wrap gap-4'>
            {candidates.map(candidate => (
              <VolunteerCard
                key={candidate.id}
                candidate={candidate}
                role={role}
                currentUser={currentUser}
                myTrustValue={myTrustExpressions[candidate.id] || 0}
                onTrust={onTrust}
                onResign={onResign}
                trustDetails={getTrustDetails(candidate.id)}
                groupSlug={groupSlug}
              />
            ))}
            {canVolunteer && renderVolunteerCTA()}
          </div>
        </div>
      )}

      {canVolunteer && candidates.length === 0 && stewards.length === 0 && (
        <div className='mb-6'>
          <div className='flex flex-wrap gap-4'>
            {renderVolunteerCTA()}
          </div>
        </div>
      )}



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



function VolunteerCard ({ candidate, role, currentUser, myTrustValue, onTrust, onResign, isSteward = false, trustDetails, groupSlug }) {

  const { t } = useTranslation()

  const [trustValue, setTrustValue] = useState(myTrustValue)

  const [isUpdating, setIsUpdating] = useState(false)

  const [showTrustModal, setShowTrustModal] = useState(false)
  const profileUrl = personUrl(candidate.id, groupSlug)



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
  const bannerImage = candidate.bannerUrl || DEFAULT_ROLE_BANNER
  const cardStyle = bannerImage
    ? { backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.75), rgba(0,0,0,0.35)), url(${bannerImage})` }
    : { backgroundImage: 'linear-gradient(135deg, rgba(0,0,0,0.75), rgba(0,0,0,0.35))' }

  return (
    <div
      className='relative w-[12.6rem] min-h-[14.7rem] rounded-2xl overflow-hidden shadow-lg flex flex-col text-white'
      style={cardStyle}
    >
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_transparent_45%)]' />
      <div className='relative flex flex-col gap-4 p-3 grow'>
        <div className='flex flex-col items-center gap-3 mt-6'>
          <Link
            to={profileUrl}
            className='inline-flex rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'
          >
            <RoundImage
              url={candidate.avatarUrl}
              large
              className='w-20 h-20 rounded-2xl border-2 border-white/40 shadow-lg'
            />
          </Link>
          <div className='w-full flex flex-col items-center gap-2 text-center text-white'>
            <Link
              to={profileUrl}
              className='flex items-center justify-center gap-2 text-base font-semibold text-white hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 rounded-md px-2 py-1'
            >
              <span className='truncate max-w-[11rem]'>{candidate.name}</span>
              {isOwnCandidate && (
                <span className='text-xs text-blue-200 font-medium'>({t('You')})</span>
              )}
            </Link>
            <div className='relative pointer-events-auto w-full'>
              <button
                type='button'
                onClick={() => trustDetails && setShowTrustModal(true)}
                className='w-full flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-white/80 px-3 py-1 rounded-full bg-black/30 border border-white/10 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-default disabled:opacity-70'
                disabled={!trustDetails}
                aria-label={t('View trust supporters')}
              >
                <span className='truncate w-full text-left'>{isSteward ? `${role.emoji ? role.emoji + ' ' : ''}${role.name}` : t('Volunteer')}</span>
                {trustDetails && (
                  <span className='font-semibold text-[10px] tracking-wide flex-shrink-0'>
                    {Math.round((trustDetails.average || 0) * 100)}%
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {!isOwnCandidate && (
          <div className='bg-black/50 rounded-2xl p-3 border border-white/10'>
            <div className='flex items-center justify-between text-xs text-white/70 mb-2'>
              <span>{t('Your vote')}</span>
              <span>{Math.round(trustValue * 100)}%</span>
            </div>
            <TrustSlider
              value={trustValue}
              onChange={handleTrustChange}
              disabled={isUpdating}
            />
          </div>
        )}

        {isOwnCandidate && (
          <button
            onClick={() => onResign(role.id, { isSteward })}
            className='flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500/80 text-white rounded-xl hover:bg-red-500 transition-colors font-medium'
          >
            {t('Resign from this role')}
          </button>
        )}

        {showTrustModal && trustDetails && (
          <div className='absolute inset-0 z-50 flex rounded-2xl'>
            <div className='absolute inset-0 rounded-2xl bg-black/80 backdrop-blur-sm' />
            <div className='relative z-10 flex flex-col w-full rounded-2xl border border-white/15 bg-black/95 p-4 text-white'>
              <div className='flex items-start gap-2'>
                <div className='text-sm font-semibold leading-tight'>{t('Votes')}</div>
                <button
                  type='button'
                  onClick={() => setShowTrustModal(false)}
                  className='ml-auto text-white/70 hover:text-white transition-colors'
                  aria-label={t('Close')}
                >
                  <X size={16} />
                </button>
              </div>
              <div className='mt-3 flex-1 overflow-y-auto pr-1 space-y-2 text-xs'>
                {trustDetails.expressions?.length > 0
                  ? trustDetails.expressions.map(expr => (
                    <Link
                      key={`${expr.trustorId}-${expr.trusteeId}`}
                      to={personUrl(expr.trustorId, groupSlug)}
                      className='flex items-center gap-3 px-1 py-2 border-b border-white/15 last:border-b-0 text-white/90 hover:text-white hover:bg-white/10 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60'
                    >
                      <RoundImage url={expr.trustorAvatarUrl} small className='w-7 h-7 rounded-full border border-white/20 flex-shrink-0' />
                      <span className='flex-1 font-medium truncate text-left'>{expr.trustorName || t('Member {{id}}', { id: expr.trustorId })}</span>
                      <span className='text-sm font-semibold text-right ml-auto'>{Math.round((expr.value || 0) * 100)}%</span>
                    </Link>
                    ))
                  : <div className='text-white/60'>{t('No expressions yet')}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

}

 
