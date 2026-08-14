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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import useRouteParams from 'hooks/useRouteParams'
import MenuRowBackground from 'routes/AuthLayoutRouter/components/ContextMenu/MenuRowBackground'
import GroupViewPresenter, { avatarForView, iconForView } from '@hylo/presenters/GroupViewPresenter'
import { leaveGroup } from 'routes/UserSettings/UserGroupsTab/UserGroupsTab.store'
import { updateMembershipSettings } from 'routes/UserSettings/UserSettings.store'
import fetchForGroup from 'store/actions/fetchForGroup'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { DEFAULT_BANNER, accessibilityIcon, spaceAccessDescription } from 'store/models/Group'
import { bgImageStyle, cn } from 'util/index'

/**
 * What a space is for, over whatever you were looking at. A modal rather than a
 * page because it answers a question about the space you are already in — the
 * design's Views list is deliberately omitted, since the menu is the place that
 * lists views.
 */
export default function SpaceAboutModal ({ onClose }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const spaceFullSlug = useEffectiveGroupSlug()
  const spaceGroup = useSelector(state => getGroupForSlug(state, spaceFullSlug))
  const detailsLoaded = spaceGroup?.accessibility != null

  // Access is described in terms of the parent group (its name and roles)
  const routeParams = useRouteParams()
  const parentSlug = routeParams.groupSlug
  const parentGroup = useSelector(state => getGroupForSlug(state, parentSlug))
  const parentRolesLoaded = parentGroup?.groupRoles != null

  useEffect(() => {
    if (parentSlug && !parentRolesLoaded) dispatch(fetchForGroup(parentSlug))
  }, [dispatch, parentSlug, parentRolesLoaded])

  const requiredRoles = useMemo(() => {
    const ids = spaceGroup?.requiredRoles || []
    const parentRoles = parentGroup?.groupRoles?.items || []
    return ids
      .map(id => parentRoles.find(role => String(role.id) === String(id)))
      .filter(Boolean)
  }, [spaceGroup?.requiredRoles, parentGroup?.groupRoles])

  // Membership carries the per-space notification settings and makes Leave real
  const myMemberships = useSelector(getMyMemberships)
  const membership = useMemo(
    () => spaceGroup?.id
      ? myMemberships.find(m => String(m.group.id) === String(spaceGroup.id))
      : null,
    [spaceGroup?.id, myMemberships]
  )
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  const updateMySettings = useCallback(changes => {
    if (!spaceGroup?.id) return
    dispatch(updateMembershipSettings(spaceGroup.id, changes))
  }, [dispatch, spaceGroup?.id])

  const handleConfirmLeave = useCallback(() => {
    if (!spaceGroup?.id) return
    dispatch(leaveGroup(spaceGroup.id)).then(() => {
      setShowLeaveDialog(false)
      // Membership is gone; closing lands on the space root, which now shows the join page
      onClose?.()
    })
  }, [dispatch, spaceGroup?.id, onClose])

  useEffect(() => {
    if (spaceFullSlug && !detailsLoaded) dispatch(fetchForGroup(spaceFullSlug))
  }, [dispatch, spaceFullSlug, detailsLoaded])

  const spaceView = useMemo(() => spaceGroup
    ? { type: 'space', name: spaceGroup.name, icon: spaceGroup.icon, linkedGroup: spaceGroup }
    : null, [spaceGroup])
  // GroupViewIcon — and so the banner's glyph wallpaper — reads presenter fields
  // (lucideIcon, avatarUrl); the raw view shape renders empty glyphs
  const presentedSpaceView = useMemo(() => spaceView ? GroupViewPresenter(spaceView) : null, [spaceView])
  const avatar = useMemo(() => avatarForView(spaceView), [spaceView])
  const icon = useMemo(() => iconForView(spaceView), [spaceView])

  const bannerUrl = spaceGroup?.bannerUrl && spaceGroup.bannerUrl !== DEFAULT_BANNER
    ? spaceGroup.bannerUrl
    : null

  const accessDescription = spaceGroup && detailsLoaded
    ? spaceAccessDescription({
      space: spaceGroup,
      parentGroupName: parentGroup?.name || '',
      requiredRoles,
      t
    })
    : ''

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose?.() }}>
        {/* p-0 so the banner can run to the edges; the dialog's own close button sits
            over it, which is why the banner carries a scrim */}
        <DialogContent className='max-w-[560px] w-[calc(100%-2rem)] p-0 overflow-hidden gap-0 max-h-[85vh] flex flex-col'>
          <DialogTitle className='sr-only'>{t('About')}</DialogTitle>

          {!spaceGroup || !detailsLoaded
            ? <div className='p-10'><Loading /></div>
            : (
              <>
                {/* Banner laid out like the one-column space banner: identity (tile,
                    name, member pill) centered over the photo or glyph texture */}
                <div className='relative h-[172px] grid place-items-center overflow-hidden shrink-0'>
                  {bannerUrl
                    ? (
                      <>
                        <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bannerUrl)} />
                        {/* The card's scrim, stop for stop */}
                        <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
                      </>
                      )
                    // No banner: the same repeating icon texture the space wears in the
                    // menu and cards, so the modal is recognisably that space's surface
                    // Two rows beyond full coverage: the -8° tilt lifts each row's
                    // right end, draining the bottom-right corner first
                    : <MenuRowBackground view={presentedSpaceView} bannerUrl={null} glyphCount={360} />}

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

                <div className='p-7 overflow-y-auto flex-1 min-h-0'>
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
                  <div className='flex items-start gap-2.5 rounded-lg border border-foreground/10 bg-background/40 px-3 py-2.5 mt-5'>
                    {spaceGroup.paywall
                      ? <BadgeDollarSign className='w-4 h-4 shrink-0 text-foreground/60 mt-0.5' />
                      : <Icon name={accessibilityIcon(spaceGroup.accessibility)} className='shrink-0 text-foreground/60 mt-0.5' />}
                    <div className='min-w-0'>
                      <div className='text-[10px] font-bold uppercase tracking-wider text-foreground/50'>{t('Access')}</div>
                      <div className='text-sm font-medium text-foreground'>{accessDescription}</div>
                    </div>
                  </div>

                  {/* Notification settings and Leave — space members see this modal
                      instead of GroupDetail About, so these live here */}
                  {membership?.settings && (
                    <div className='border-2 border-dashed border-foreground/20 rounded-xl p-4 mt-5'>
                      <h3 className='text-lg font-bold m-0 py-1'>{t('Notification Settings')}</h3>
                      <div className='flex items-center justify-between gap-2 py-2'>
                        <span className='text-sm text-foreground/80'>{t('Receive new post notifications in this space for')}</span>
                        <Select
                          value={membership.settings.postNotifications}
                          onValueChange={value => updateMySettings({ postNotifications: value })}
                        >
                          <SelectTrigger className='inline-flex w-auto'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className='!z-[1200]'>
                            <SelectItem value='none'>{t('No Posts')}</SelectItem>
                            <SelectItem value='important'>{t('Important Posts (Announcements & Mentions)')}</SelectItem>
                            <SelectItem value='all'>{t('Every Post')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {membership && (
                    <div className='mt-4 flex justify-center'>
                      <Button
                        variant='outline'
                        onClick={() => setShowLeaveDialog(true)}
                        className='border-accent/20 hover:border-accent/100 text-accent/60 hover:text-accent/100'
                      >
                        {t('Leave Space')}
                      </Button>
                    </div>
                  )}
                </div>
              </>
              )}
        </DialogContent>
      </Dialog>

      {/* Sibling dialog (not nested) so Leave confirm isn't trapped in the About modal */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Leave Space')}</DialogTitle>
            <DialogDescription className='text-foreground/70'>
              {t('Are you sure you want to leave {{group_name}}? You will no longer have access to this space\'s content.', { group_name: spaceGroup?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='flex gap-2 mt-4'>
            <Button variant='outline' onClick={() => setShowLeaveDialog(false)}>
              {t('Cancel')}
            </Button>
            <Button variant='destructive' onClick={handleConfirmLeave}>
              {t('Leave Space')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
