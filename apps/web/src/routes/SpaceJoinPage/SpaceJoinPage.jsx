import { BadgeDollarSign, Users } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'

import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import MenuRowBackground from 'routes/AuthLayoutRouter/components/ContextMenu/MenuRowBackground'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import Button from 'components/ui/button'
import { bgImageStyle, cn } from 'util/index'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useKeyJoinRequestsByGroupId } from 'hooks/useGetJoinRequests'
import useRouteParams from 'hooks/useRouteParams'
import GroupViewPresenter, { avatarForView, iconForView } from '@hylo/presenters/GroupViewPresenter'
import { createJoinRequest } from 'routes/GroupDetail/GroupDetail.store'
import PaywallOfferingsSection from 'routes/GroupDetail/PaywallOfferingsSection'
import fetchForGroup from 'store/actions/fetchForGroup'
import joinSpace from 'store/actions/joinSpace'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADMINISTRATION } from 'store/constants'
import { DEFAULT_BANNER, GROUP_ACCESSIBILITY, accessibilityIcon, spaceAccessDescription } from 'store/models/Group'

/**
 * Interstitial shown when a signed-in member of the parent group clicks into a Space
 * they haven't joined yet. Describes the space and its access requirements, and offers
 * a way to join, request to join, or pay to join depending on the space's settings.
 * Rendered by SpaceContent in place of the space's normal routes until membership exists.
 */
export default function SpaceJoinPage () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const location = useLocation()
  const routeParams = useRouteParams()
  const parentSlug = routeParams.groupSlug
  const spaceFullSlug = useEffectiveGroupSlug()
  const accessCode = getQuerystringParam('accessCode', location)
  const invitationToken = getQuerystringParam('token', location)
  const hasJoinOrInviteLink = !!(accessCode || invitationToken)

  const parentGroup = useSelector(state => getGroupForSlug(state, parentSlug))
  const spaceGroup = useSelector(state => getGroupForSlug(state, spaceFullSlug))
  const currentUser = useSelector(getMe)
  const canAdministerParent = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION,
    groupId: parentGroup?.id
  }))
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
  const presentedSpaceView = useMemo(() => spaceView ? GroupViewPresenter(spaceView) : null, [spaceView])
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
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false)

  const handleJoinSpace = useCallback(async () => {
    setActionError(null)
    setJoining(true)
    try {
      await dispatch(joinSpace(spaceGroup.id, accessCode, invitationToken))
    } catch (error) {
      setActionError(error.message || t('Something went wrong. Please try again.'))
    } finally {
      setJoining(false)
    }
  }, [dispatch, spaceGroup?.id, accessCode, invitationToken, t])

  // Join/invite links auto-join; SpaceContent then shows the space instead of this page
  useEffect(() => {
    if (!hasJoinOrInviteLink || !spaceGroup?.id || spaceGroup.paywall || autoJoinAttempted) return
    setAutoJoinAttempted(true)
    handleJoinSpace()
  }, [hasJoinOrInviteLink, spaceGroup?.id, spaceGroup?.paywall, autoJoinAttempted, handleJoinSpace])

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

  const autoJoining = hasJoinOrInviteLink && !spaceGroup?.paywall && (!autoJoinAttempted || joining)
  if (!parentGroup || !spaceGroup || !spaceDetailsLoaded || autoJoining) return <Loading />

  const bannerUrl = spaceGroup.bannerUrl && spaceGroup.bannerUrl !== DEFAULT_BANNER
    ? spaceGroup.bannerUrl
    : null

  const isRoleGated = !spaceGroup.paywall && (spaceGroup.requiredRoles || []).length > 0

  // Parent-group admins can always join; a join/invite link pre-approves Closed,
  // Restricted, and role-gated spaces; role-holders and open spaces join directly
  const canJoinDirectly = canAdministerParent || (
    !spaceGroup.paywall && (
      hasJoinOrInviteLink ||
      (isRoleGated && hasRequiredRole) ||
      spaceGroup.accessibility === GROUP_ACCESSIBILITY.Open
    )
  )

  const accessDescription = spaceAccessDescription({
    space: spaceGroup,
    parentGroupName: parentGroup.name,
    requiredRoles,
    t
  })

  return (
    // flex-1 fills the center column below the view header (a flex column), so
    // m-auto centers the card in the visible area; unlike items/justify-center,
    // auto margins let a card taller than the viewport scroll from its top edge
    <div className='w-full flex-1 flex'>
      <div className='m-auto w-full max-w-[840px] p-6'>
        <div className='rounded-2xl border border-foreground/10 bg-card overflow-hidden shadow-lg'>
          {/* Banner laid out like the one-column space banner: identity (tile,
              name, member pill) centered over the photo or glyph texture */}
          <div className='relative h-[172px] grid place-items-center overflow-hidden'>
            {bannerUrl
              ? (
                <>
                  <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bannerUrl)} />
                  <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)' }} />
                </>
                )
              // No banner: the same repeating icon texture the space wears in its
              // About modal, menu row, and cards — one recognisable surface
              : <MenuRowBackground view={presentedSpaceView} bannerUrl={null} rows={8} spaced className='rounded-none' />}

            <div className='relative z-10 flex flex-col items-center justify-center gap-1 max-w-full px-4'>
              <div className={cn(
                'w-14 h-14 rounded-xl shadow-lg bg-cover bg-center overflow-hidden relative grid place-items-center backdrop-blur-sm',
                bannerUrl ? 'bg-white/15 text-white' : 'bg-black/5 text-foreground/80 dark:bg-white/15 dark:text-white'
              )}
              >
                {avatar?.avatarUrl
                  ? <div className='w-full h-full bg-cover bg-center' style={bgImageStyle(avatar.avatarUrl)} />
                  : icon.lucideIcon
                    ? <LucideIcon name={icon.lucideIcon} className='w-7 h-7' fallback={<Icon name={icon.lucideIcon} className='text-2xl' />} />
                    : <Icon name={icon.iconName || 'Shapes'} className='text-2xl' />}
              </div>
              <h1 className={cn('text-xl font-bold drop-shadow-md m-0 leading-tight max-w-full truncate', bannerUrl ? 'text-white' : 'text-foreground dark:text-white')}>
                {spaceGroup.name}
              </h1>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                bannerUrl
                  ? 'bg-white/15 border-white/25 text-white'
                  : 'bg-foreground/10 border-foreground/20 text-foreground/80 dark:bg-white/15 dark:border-white/25 dark:text-white/90'
              )}
              >
                <Users className='w-3.5 h-3.5' />
                {spaceGroup.memberCount || 0}
              </span>
            </div>
          </div>

          <div className='p-7 flex flex-col'>
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

            {/* Members moved to the banner pill; access reads as a sentence */}
            <div className='flex items-center gap-2.5 rounded-lg border border-foreground/10 bg-background/40 px-3 py-2.5 mt-5'>
              {spaceGroup.paywall
                ? <BadgeDollarSign className='w-9 h-9 shrink-0 text-foreground/60' />
                : <Icon name={accessibilityIcon(spaceGroup.accessibility)} className='shrink-0 text-foreground/60 text-4xl leading-none' />}
              <div className='min-w-0'>
                <div className='text-[10px] font-bold uppercase tracking-wider text-foreground/50'>{t('Access')}</div>
                <div className='text-sm font-medium text-foreground'>{accessDescription}</div>
              </div>
            </div>

            <div className='w-full mt-5'>
              {actionError && (
                <p className='text-sm text-red-500 mb-2'>{actionError}</p>
              )}

              {canJoinDirectly
                ? (
                  <Button variant='highVisibility' className='w-full justify-center' onClick={handleJoinSpace} disabled={joining}>
                    {joining ? t('Joining...') : t('Join Space')}
                  </Button>
                  )
                : spaceGroup.paywall
                  ? (
                    <div className='w-full text-left'>
                      <p className='text-sm text-foreground/70 mb-3 text-center'>{t('Pay to Join Space')}</p>
                      <PaywallOfferingsSection group={spaceGroup} sellingGroup={parentGroup} />
                    </div>
                    )
                  : isRoleGated
                    ? (
                      <p className='text-sm text-foreground/60'>
                        {t('You do not have a role needed to join this space')}
                      </p>
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
                          <Button variant='highVisibility' className='w-full justify-center' onClick={handleRequestToJoin} disabled={requesting}>
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
    </div>
  )
}
