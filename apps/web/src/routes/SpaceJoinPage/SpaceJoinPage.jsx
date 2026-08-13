import { BadgeDollarSign, Users } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import Button from 'components/ui/button'
import { bgImageStyle, cn } from 'util/index'
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
import { DEFAULT_BANNER, GROUP_ACCESSIBILITY, accessibilityIcon } from 'store/models/Group'

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
      title: '',
      icon: '',
      search: false
    })
  }, [setHeaderDetails])

  // Required roles are role ids from the parent group — a Space's access is gated by
  // roles the user holds in the parent, not roles on the space itself.
  const requiredRoles = useMemo(() => {
    const ids = spaceGroup?.requiredRoles || []
    const parentRoles = parentGroup?.groupRoles?.items || []
    return ids
      .map(id => parentRoles.find(role => String(role.id) === String(id)))
      .filter(Boolean)
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

  const bannerUrl = spaceGroup.bannerUrl && spaceGroup.bannerUrl !== DEFAULT_BANNER
    ? spaceGroup.bannerUrl
    : null

  const isRoleGated = !spaceGroup.paywall && (spaceGroup.requiredRoles || []).length > 0

  const accessLabel = spaceGroup.paywall
    ? t('Paid')
    : isRoleGated
      ? t('Open to Roles')
      : spaceGroup.accessibility === GROUP_ACCESSIBILITY.Open
        ? t('Open')
        : spaceGroup.accessibility === GROUP_ACCESSIBILITY.Restricted
          ? t('Restricted - you need to request to join')
          : t('Invite Only')

  return (
    <div className='p-6 pb-16 w-full max-w-[620px] mx-auto'>
      <div className='rounded-2xl border border-foreground/10 bg-card overflow-hidden shadow-lg'>
        {/* The space's own banner, per the design — a tinted wash when it has none,
            so the identity block reads the same either way */}
        <div className='relative h-[140px] grid place-items-center overflow-hidden'>
          {bannerUrl
            ? (
              <>
                <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bannerUrl)} />
                <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)' }} />
              </>
              )
            : <div className='absolute inset-0 bg-gradient-to-br from-focus/70 to-selected/70' />}

          <div className='relative z-10 w-[84px] h-[84px] rounded-[22px] grid place-items-center overflow-hidden bg-background/20 backdrop-blur-sm border border-white/25 shadow-lg text-white'>
            {avatar?.avatarUrl
              ? <div className='w-full h-full bg-cover bg-center' style={bgImageStyle(avatar.avatarUrl)} />
              : icon.lucideIcon
                ? <LucideIcon name={icon.lucideIcon} className='w-10 h-10' fallback={<Icon name={icon.lucideIcon} className='text-4xl' />} />
                : <Icon name={icon.iconName || 'Shapes'} className='text-4xl' />}
          </div>
        </div>

        <div className='p-7 flex flex-col'>
          <h1 className='text-2xl font-bold text-foreground m-0'>{spaceGroup.name}</h1>

          {spaceGroup.purpose && (
            <p className='text-foreground/80 font-medium mt-2 mb-0'>{spaceGroup.purpose}</p>
          )}

          {spaceGroup.description && (
            <div className='text-foreground/70 text-sm global-postContent mt-3'>
              <ClickCatcher groupSlug={spaceFullSlug}>
                <HyloHTML html={spaceGroup.description} />
              </ClickCatcher>
            </div>
          )}

          {/* Facts as a grid rather than stacked rows, per the design */}
          <div className='grid grid-cols-2 gap-2 mt-5'>
            <div className='flex items-center gap-2.5 rounded-lg border border-foreground/10 bg-background/40 px-3 py-2.5'>
              <Users className='w-4 h-4 shrink-0 text-foreground/60' />
              <div className='min-w-0'>
                <div className='text-[10px] font-bold uppercase tracking-wider text-foreground/50'>{t('Members')}</div>
                <div className='text-sm font-bold text-foreground'>{spaceGroup.memberCount || 0}</div>
              </div>
            </div>
            <div className='flex items-start gap-2.5 rounded-lg border border-foreground/10 bg-background/40 px-3 py-2.5'>
              {spaceGroup.paywall
                ? <BadgeDollarSign className='w-4 h-4 shrink-0 text-foreground/60 mt-0.5' />
                : <Icon name={accessibilityIcon(spaceGroup.accessibility)} className='shrink-0 text-foreground/60 mt-0.5' />}
              <div className='min-w-0'>
                <div className='text-[10px] font-bold uppercase tracking-wider text-foreground/50'>{t('Access')}</div>
                <div className={cn('flex flex-wrap items-center gap-1.5', !isRoleGated && 'truncate')} title={accessLabel}>
                  <span className='text-sm font-bold text-foreground'>{accessLabel}</span>
                  {isRoleGated && requiredRoles.map(role => (
                    <span
                      key={role.id}
                      className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-2 border-foreground/20 text-xs font-medium text-foreground whitespace-nowrap'
                    >
                      {role.emoji && <span>{role.emoji}</span>}
                      <span>{role.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className='w-full mt-5'>
            {actionError && (
              <p className='text-sm text-red-500 mb-2'>{actionError}</p>
            )}

            {spaceGroup.paywall
              ? (
                <div className='w-full text-left'>
                  <p className='text-sm text-foreground/70 mb-3 text-center'>{t('Pay to Join Space')}</p>
                  <PaywallOfferingsSection group={spaceGroup} />
                </div>
                )
              : isRoleGated
                ? hasRequiredRole
                  ? (
                    <Button variant='secondary' className='w-full' onClick={handleJoinSpace} disabled={joining}>
                      {joining ? t('Joining...') : t('Join Space')}
                    </Button>
                    )
                  : (
                    <p className='text-sm text-foreground/60'>
                      {t('You do not have a role needed to join this space')}
                    </p>
                    )
                : spaceGroup.accessibility === GROUP_ACCESSIBILITY.Open
                  ? (
                    <Button variant='secondary' className='w-full' onClick={handleJoinSpace} disabled={joining}>
                      {joining ? t('Joining...') : t('Join Space')}
                    </Button>
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
      </div>
    </div>
  )
}
