import { BadgeDollarSign } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

import Avatar from 'components/Avatar'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import Button from 'components/ui/button'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useKeyJoinRequestsByGroupId } from 'hooks/useGetJoinRequests'
import useRouteParams from 'hooks/useRouteParams'
import { avatarForView, iconForView } from '@hylo/presenters/GroupViewPresenter'
import { createJoinRequest } from 'routes/GroupDetail/GroupDetail.store'
import PaywallOfferingsSection from 'routes/GroupDetail/PaywallOfferingsSection'
import fetchForGroup from 'store/actions/fetchForGroup'
import joinSpace from 'store/actions/joinSpace'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import { GROUP_ACCESSIBILITY, accessibilityIcon } from 'store/models/Group'

/**
 * Interstitial shown when a signed-in member of the parent group clicks into a Space
 * they haven't joined yet. Describes the space and its access requirements, and offers
 * a way to join, request to join, or pay to join depending on the space's settings.
 * Rendered by SpaceContent in place of the space's normal routes until membership exists.
 */
export default function SpaceJoinPage () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const parentSlug = routeParams.groupSlug
  const spaceFullSlug = useEffectiveGroupSlug()

  const parentGroup = useSelector(state => getGroupForSlug(state, parentSlug))
  const spaceGroup = useSelector(state => getGroupForSlug(state, spaceFullSlug))
  const currentUser = useSelector(getMe)
  const groupsWithPendingRequests = useKeyJoinRequestsByGroupId()

  const spaceDetailsLoaded = spaceGroup?.accessibility != null
  const parentRolesLoaded = parentGroup?.groupRoles != null

  useEffect(() => {
    if (spaceFullSlug && !spaceDetailsLoaded) dispatch(fetchForGroup(spaceFullSlug))
  }, [dispatch, spaceFullSlug, spaceDetailsLoaded])

  useEffect(() => {
    if (parentSlug && !parentRolesLoaded) dispatch(fetchForGroup(parentSlug))
  }, [dispatch, parentSlug, parentRolesLoaded])

  const spaceView = useMemo(() => spaceGroup
    ? { type: 'space', name: spaceGroup.name, icon: spaceGroup.icon, linkedGroup: spaceGroup }
    : null, [spaceGroup])
  const avatar = useMemo(() => avatarForView(spaceView), [spaceView])
  const icon = useMemo(() => iconForView(spaceView), [spaceView])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: spaceGroup?.name || t('Join Space'),
      icon: '',
      search: false,
      spaceBreadcrumb: false
    })
  }, [spaceGroup?.name, setHeaderDetails, t])

  // Required roles are role ids from the parent group — a Space's access is gated by
  // roles the user holds in the parent, not roles on the space itself.
  const requiredRoleNames = useMemo(() => {
    const ids = spaceGroup?.requiredRoles || []
    const parentRoles = parentGroup?.groupRoles?.items || []
    return ids
      .map(id => parentRoles.find(role => String(role.id) === String(id)))
      .filter(Boolean)
      .map(role => role.name)
  }, [spaceGroup?.requiredRoles, parentGroup?.groupRoles])

  const hasRequiredRole = useMemo(() => {
    const requiredIds = spaceGroup?.requiredRoles || []
    if (requiredIds.length === 0) return true
    const myRoleIds = (currentUser?.groupRoles?.items || [])
      .filter(role => String(role.groupId) === String(parentGroup?.id))
      .map(role => String(role.id))
    return requiredIds.some(id => myRoleIds.includes(String(id)))
  }, [spaceGroup?.requiredRoles, currentUser?.groupRoles, parentGroup?.id])

  const hasPendingRequest = Boolean(spaceGroup?.id && groupsWithPendingRequests[spaceGroup.id])

  const [joining, setJoining] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [showPaywall, setShowPaywall] = useState(false)

  const handleJoinSpace = useCallback(async () => {
    setActionError(null)
    setJoining(true)
    try {
      await dispatch(joinSpace(spaceGroup.id))
    } catch (error) {
      setActionError(error.message || t('Something went wrong. Please try again.'))
    } finally {
      setJoining(false)
    }
  }, [dispatch, spaceGroup?.id, t])

  const handleRequestToJoin = useCallback(async () => {
    setActionError(null)
    setRequesting(true)
    try {
      await dispatch(createJoinRequest(spaceGroup.id, []))
    } catch (error) {
      setActionError(error.message || t('Something went wrong. Please try again.'))
    } finally {
      setRequesting(false)
    }
  }, [dispatch, spaceGroup?.id, t])

  if (!parentGroup || !spaceGroup || !spaceDetailsLoaded) return <Loading />

  return (
    <div className='p-6 max-w-[550px] mx-auto flex flex-col items-center text-center gap-3'>
      {avatar?.avatarUrl
        ? <Avatar avatarUrl={avatar.avatarUrl} name={avatar.displayName} large />
        : icon.lucideIcon
          ? <LucideIcon name={icon.lucideIcon} className='w-16 h-16 text-foreground/70' fallback={<Icon name={icon.lucideIcon} className='text-5xl' />} />
          : <Icon name={icon.iconName || 'Shapes'} className='text-5xl' />}

      <h1 className='text-2xl font-bold text-foreground'>{spaceGroup.name}</h1>

      {spaceGroup.purpose && (
        <p className='text-foreground/80 font-medium'>{spaceGroup.purpose}</p>
      )}

      {spaceGroup.description && (
        <div className='text-foreground/70 text-sm global-postContent'>
          <ClickCatcher groupSlug={spaceFullSlug}>
            <HyloHTML html={spaceGroup.description} />
          </ClickCatcher>
        </div>
      )}

      <div className='flex items-center gap-2 text-foreground/60 mt-2'>
        <Icon name='People' />
        <span>{t('{{count}} Members', { count: spaceGroup.memberCount || 0 })}</span>
      </div>

      <div className='flex items-center gap-2 text-foreground/60'>
        {spaceGroup.paywall
          ? <BadgeDollarSign className='w-4 h-4' />
          : <Icon name={accessibilityIcon(spaceGroup.accessibility)} />}
        <span>
          <span>Access:&nbsp;</span>
          {spaceGroup.paywall
            ? t('Paid')
            : spaceGroup.accessibility === GROUP_ACCESSIBILITY.Open
              ? (requiredRoleNames.length > 0
                  ? t('Open for {{roles}}', { roles: requiredRoleNames.join(', ') })
                  : t('Open'))
              : spaceGroup.accessibility === GROUP_ACCESSIBILITY.Restricted
                ? t('Restricted - you need to request to join')
                : t('Invite Only')}
        </span>
      </div>

      <div className='w-full mt-4'>
        {actionError && (
          <p className='text-sm text-red-500 mb-2'>{actionError}</p>
        )}

        {spaceGroup.paywall
          ? (
            <>
              <Button variant='secondary' className='w-full' onClick={() => setShowPaywall(true)}>
                {t('Pay to Join Space')}
              </Button>
              {showPaywall && (
                <div className='mt-4 w-full text-left'>
                  <PaywallOfferingsSection group={spaceGroup} />
                </div>
              )}
            </>
            )
          : spaceGroup.accessibility === GROUP_ACCESSIBILITY.Open
            ? (
              <>
                {!hasRequiredRole && requiredRoleNames.length > 0 && (
                  <p className='text-sm text-foreground/60 mb-2'>
                    {t('You need the {{roles}} role in {{parentName}} to join this space', { roles: requiredRoleNames.join(', '), parentName: parentGroup.name })}
                  </p>
                )}
                <Button variant='secondary' className='w-full' onClick={handleJoinSpace} disabled={joining || !hasRequiredRole}>
                  {joining ? t('Joining...') : t('Join Space')}
                </Button>
              </>
              )
            : spaceGroup.accessibility === GROUP_ACCESSIBILITY.Restricted
              ? hasPendingRequest
                ? (
                  <div className='border-2 border-dashed border-selected/100 rounded-md text-center p-4 text-foreground'>
                    <h3 className='mt-0 text-foreground font-bold mb-2'>{t('Request to join pending')}</h3>
                    <span>{t('You will be sent an email and notified on your device when the request is approved.')}</span>
                  </div>
                  )
                : (
                  <Button variant='secondary' className='w-full' onClick={handleRequestToJoin} disabled={requesting}>
                    {requesting ? t('Requesting...') : t('Request to Join Space')}
                  </Button>
                  )
              : (
                <p className='text-sm text-foreground/60'>
                  {t('This space is invite only. You need an invitation to join.')}
                </p>
                )}
      </div>
    </div>
  )
}
