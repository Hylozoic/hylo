import { Bell, Info, LogOut, MapPin, Settings, ShieldCheck, Users } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import RoundImage from 'components/RoundImage'
import Button from 'components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'components/ui/dialog'
import GroupMembershipNotificationSettings from 'routes/UserSettings/NotificationSettingsTab/GroupMembershipNotificationSettings'
import { updateMembershipSettings } from 'routes/UserSettings/UserSettings.store'
import { leaveGroup } from 'routes/UserSettings/UserGroupsTab/UserGroupsTab.store'
import MenuRowBackground from 'routes/AuthLayoutRouter/components/ContextMenu/MenuRowBackground'
import SpaceSettingsModal from 'routes/AuthLayoutRouter/components/ContextMenu/SpaceSettingsModal'
import Members from 'routes/Members'
import Moderation from 'routes/Moderation'
import GroupViewPresenter, { avatarForView, iconForView } from '@hylo/presenters/GroupViewPresenter'
import { groupUrl } from '@hylo/navigation'
import { RESP_ADMINISTRATION } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getMyMemberships from 'store/selectors/getMyMemberships'
import {
  DEFAULT_AVATAR, DEFAULT_BANNER,
  accessibilityDescription, accessibilityIcon,
  visibilityDescription, visibilityIcon,
  spaceAccessDescription
} from 'store/models/Group'
import { bgImageStyle, cn } from 'util/index'

/**
 * Shared About surface for groups and spaces, per the redesign: a banner with
 * the identity, then a tab menu that imports each template inline — Moderation,
 * About, Notification Settings, Members — plus Settings (groups navigate to the
 * settings page; spaces edit inline underneath).
 */

function AboutCard ({ title, action, children, className }) {
  return (
    <section className={cn('bg-card border border-foreground/10 rounded-xl px-5 py-4', className)}>
      {(title || action) && (
        <div className='flex items-center gap-3 mb-3'>
          <h2 className='flex-1 m-0 text-base font-bold text-foreground'>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function AboutPanel ({ group, parentGroup, isSpace, membership, onLeave, t }) {
  const stewards = group.stewards && group.stewards.length > 0 ? group.stewards : null
  const agreements = group.agreements?.length ? group.agreements : null

  return (
    <div className='flex flex-col gap-4'>
      {group.purpose && (
        <AboutCard title={t('Purpose')}>
          <p className='m-0 text-sm leading-relaxed text-foreground/80'>{group.purpose}</p>
        </AboutCard>
      )}
      {group.description && (
        <AboutCard title={t('Description')}>
          <div className='text-sm leading-relaxed text-foreground/80 global-postContent'>
            <ClickCatcher groupSlug={group.slug}>
              <HyloHTML html={group.description} />
            </ClickCatcher>
          </div>
        </AboutCard>
      )}
      {stewards && (
        <AboutCard title={t('Stewards')}>
          <div className='flex flex-wrap gap-2'>
            {stewards.map(steward => (
              <div key={steward.id} className='flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-full border border-foreground/15 bg-background/40'>
                <RoundImage url={steward.avatarUrl} small />
                <span className='text-sm font-semibold text-foreground'>{steward.name}</span>
              </div>
            ))}
          </div>
        </AboutCard>
      )}
      <AboutCard title={t('Privacy settings')}>
        <div className='flex flex-col gap-3'>
          {isSpace
            ? (
              <div className='flex items-start gap-3'>
                <Icon name={accessibilityIcon(group.accessibility)} className='shrink-0 text-foreground/60 text-xl leading-none mt-0.5' />
                <div className='text-sm text-foreground/80'>
                  {spaceAccessDescription({ space: group, parentGroupName: parentGroup?.name || '', requiredRoles: [], t })}
                </div>
              </div>
              )
            : (
              <>
                <div className='flex items-start gap-3'>
                  <Icon name={visibilityIcon(group.visibility)} className='shrink-0 text-foreground/60 text-xl leading-none mt-0.5' />
                  <div className='text-sm text-foreground/80'>{t(visibilityDescription(group.visibility))}</div>
                </div>
                <div className='flex items-start gap-3'>
                  <Icon name={accessibilityIcon(group.accessibility)} className='shrink-0 text-foreground/60 text-xl leading-none mt-0.5' />
                  <div className='text-sm text-foreground/80'>{t(accessibilityDescription(group.accessibility))}</div>
                </div>
              </>
              )}
        </div>
      </AboutCard>
      {agreements && (
        <AboutCard title={t('Agreements')}>
          <div className='flex flex-col gap-4'>
            {agreements.map((agreement, i) => (
              <div key={agreement.id || i} className='flex gap-3'>
                <span className='shrink-0 w-6 h-6 rounded-full bg-selected/20 text-selected grid place-items-center text-xs font-bold'>{i + 1}</span>
                <div>
                  <div className='text-sm font-bold text-foreground'>{agreement.title}</div>
                  {agreement.description && <div className='text-sm leading-relaxed text-foreground/70 mt-0.5'>{agreement.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </AboutCard>
      )}
      {membership && (
        <div className='border-2 border-dashed border-foreground/15 rounded-xl p-4 flex justify-center'>
          <Button
            variant='outline'
            onClick={onLeave}
            className='border-accent/20 hover:border-accent/100 text-accent/60 hover:text-accent/100 flex items-center gap-2'
          >
            <LogOut className='w-4 h-4' />
            {isSpace ? t('Leave Space') : t('Leave {{name}}', { name: group.name })}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function GroupAboutView ({
  group,
  parentGroup = null,
  isSpace = false,
  // Space modal: close before navigating anywhere (settings page, member profile)
  onBeforeNavigate,
  // Rendered inside a dialog: the compact member list fits better than cards
  inDialog = false,
  initialTab = 'about',
  className
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [tab, setTab] = useState(initialTab)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  const myMemberships = useSelector(getMyMemberships)
  const membership = useMemo(
    () => group?.id ? myMemberships.find(m => String(m.group?.id) === String(group.id)) : null,
    [group?.id, myMemberships]
  )
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION, groupId: group?.id
  }))
  const canAdministerParent = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION, groupId: parentGroup?.id
  }))
  const showSettings = isSpace ? (canAdminister || canAdministerParent) : canAdminister

  const bannerUrl = group?.bannerUrl && group.bannerUrl !== DEFAULT_BANNER ? group.bannerUrl : null
  const spaceView = useMemo(() => isSpace && group
    ? { type: 'space', name: group.name, icon: group.icon, linkedGroup: group }
    : null, [isSpace, group])
  const presentedSpaceView = useMemo(() => spaceView ? GroupViewPresenter(spaceView) : null, [spaceView])
  const spaceAvatar = useMemo(() => spaceView ? avatarForView(spaceView) : null, [spaceView])
  const spaceIcon = useMemo(() => spaceView ? iconForView(spaceView) : null, [spaceView])
  const groupAvatarUrl = !isSpace ? (group?.avatarUrl || DEFAULT_AVATAR) : null

  const handleConfirmLeave = useCallback(() => {
    if (!group?.id) return
    dispatch(leaveGroup(group.id)).then(() => {
      setShowLeaveDialog(false)
      onBeforeNavigate?.()
      navigate(isSpace && parentGroup ? groupUrl(parentGroup.slug) : '/')
    })
  }, [dispatch, group?.id, isSpace, parentGroup, navigate, onBeforeNavigate])

  const openGroupSettings = useCallback(() => {
    onBeforeNavigate?.()
    navigate(groupUrl(group.slug, 'settings', {}))
  }, [navigate, group?.slug, onBeforeNavigate])

  if (!group) return null

  const tabs = [
    { id: 'about', label: t('About'), icon: Info },
    { id: 'moderation', label: t('Moderation'), icon: ShieldCheck },
    { id: 'notifications', label: t('Notification Settings'), icon: Bell, hidden: !membership },
    { id: 'members', label: t('Members'), icon: Users },
    { id: 'settings', label: t('Settings'), icon: Settings, hidden: !showSettings }
  ].filter(item => !item.hidden)

  const handleTab = (id) => {
    // Group settings is a page of its own; everything else imports inline
    if (id === 'settings' && !isSpace) {
      openGroupSettings()
      return
    }
    setTab(id)
  }

  const activeTab = tabs.some(item => item.id === tab) ? tab : 'about'

  return (
    <div className={cn('GroupAboutView flex flex-col', className)}>
      {/* Banner: photo with a settling scrim, or the space's glyph texture */}
      <div className={cn('relative shrink-0 overflow-hidden flex items-end', isSpace ? 'h-[190px]' : 'h-[210px]')}>
        {bannerUrl
          ? (
            <>
              <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bannerUrl)} />
              <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 100%)' }} />
            </>
            )
          : isSpace
            ? (
              <>
                <MenuRowBackground view={presentedSpaceView} bannerUrl={null} rows={8} spaced className='rounded-none' />
                <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)' }} />
              </>
              )
            : (
              <>
                <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(DEFAULT_BANNER)} />
                <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 100%)' }} />
              </>
              )}

        <div className='relative z-10 flex items-end gap-4 px-6 pb-5 w-full max-w-[808px] mx-auto'>
          {isSpace
            ? (
              <div className={cn(
                'w-[66px] h-[66px] rounded-[17px] shrink-0 grid place-items-center overflow-hidden shadow-lg backdrop-blur-sm',
                bannerUrl ? 'bg-white/15 text-white' : 'bg-black/5 text-foreground/80 dark:bg-white/15 dark:text-white'
              )}
              >
                {spaceAvatar?.avatarUrl
                  ? <div className='w-full h-full bg-cover bg-center' style={bgImageStyle(spaceAvatar.avatarUrl)} />
                  : spaceIcon?.lucideIcon
                    ? <LucideIcon name={spaceIcon.lucideIcon} className='w-8 h-8' fallback={<Icon name={spaceIcon.lucideIcon} className='text-3xl' />} />
                    : <Icon name={spaceIcon?.iconName || 'Shapes'} className='text-3xl' />}
              </div>
              )
            : (
              <div
                className='w-[72px] h-[72px] rounded-[18px] shrink-0 bg-cover bg-center border-2 border-white/30 shadow-lg'
                style={bgImageStyle(groupAvatarUrl)}
              />
              )}
          <div className={cn('flex-1 min-w-0 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]', bannerUrl || !isSpace ? 'text-white' : 'text-foreground dark:text-white [text-shadow:none]')}>
            {/* Color repeated on the h1: a global heading rule otherwise overrides the inherited ink */}
            <h1 className={cn('m-0 text-2xl sm:text-[27px] font-bold leading-tight truncate', bannerUrl || !isSpace ? 'text-white' : 'text-foreground dark:text-white')}>{group.name}</h1>
            <div className='flex items-center flex-wrap gap-x-2.5 gap-y-1 mt-1.5 text-[13px] opacity-95'>
              <span className='inline-flex items-center gap-1.5'>
                <Icon name={isSpace ? accessibilityIcon(group.accessibility) : visibilityIcon(group.visibility)} className='text-sm leading-none' />
                {isSpace ? t('Space') : t('Group')}
              </span>
              <span className='opacity-50'>·</span>
              <span>{t('{{count}} Members', { count: group.memberCount || 0 })}</span>
              {!isSpace && group.location && (
                <>
                  <span className='opacity-50'>·</span>
                  <span className='inline-flex items-center gap-1.5'><MapPin className='w-3.5 h-3.5' />{group.location}</span>
                </>
              )}
              {isSpace && parentGroup && (
                <>
                  <span className='opacity-50'>·</span>
                  <span>{parentGroup.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab menu */}
      <div className='sticky top-0 z-20 shrink-0 bg-background border-b border-foreground/[0.08]'>
        <div className='max-w-[808px] mx-auto px-4 sm:px-6 py-2 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
          {tabs.map(item => {
            const on = item.id === activeTab && !(item.id === 'settings' && !isSpace)
            const TabIcon = item.icon
            return (
              <button
                key={item.id}
                type='button'
                onClick={() => handleTab(item.id)}
                className={cn(
                  'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap text-[13px] font-semibold border-2 transition-colors',
                  on
                    ? 'bg-selected/20 border-selected/50 text-foreground'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                )}
              >
                <TabIcon className='w-4 h-4' />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel */}
      {activeTab === 'members'
        ? (
          <div className='flex-1 min-h-0'>
            <Members context='groups' defaultDisplayMode={inDialog ? 'list' : 'card'} />
          </div>
          )
        : (
          <div className='px-4 sm:px-6 pt-6 pb-14'>
            <div className='max-w-[760px] mx-auto'>
              {activeTab === 'about' && (
                <AboutPanel
                  group={group}
                  parentGroup={parentGroup}
                  isSpace={isSpace}
                  membership={membership}
                  onLeave={() => setShowLeaveDialog(true)}
                  t={t}
                />
              )}
              {activeTab === 'moderation' && <Moderation context='groups' />}
              {activeTab === 'notifications' && membership && (
                <AboutCard title={t('Notification Settings for {{name}}', { name: group.name })}>
                  <GroupMembershipNotificationSettings
                    id={membership.id}
                    settings={membership.settings}
                    update={changes => dispatch(updateMembershipSettings(group.id, changes))}
                    compact
                  />
                </AboutCard>
              )}
              {activeTab === 'settings' && isSpace && (
                <AboutCard title={t('Space Settings')}>
                  <SpaceSettingsModal
                    inline
                    space={group}
                    group={parentGroup}
                    onClose={() => setTab('about')}
                  />
                </AboutCard>
              )}
            </div>
          </div>
          )}

      {/* Sibling dialog so the Leave confirm isn't trapped inside a modal shell */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className='!z-[1200]'>
          <DialogHeader>
            <DialogTitle>{isSpace ? t('Leave Space') : t('Leave {{name}}', { name: group.name })}</DialogTitle>
            <DialogDescription className='text-foreground/70'>
              {isSpace
                ? t('Are you sure you want to leave {{group_name}}? You will no longer have access to this space\'s content.', { group_name: group.name })
                : t('Are you sure you want to leave {{group_name}}?', { group_name: group.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='flex gap-2 mt-4'>
            <Button variant='outline' onClick={() => setShowLeaveDialog(false)}>{t('Cancel')}</Button>
            <Button variant='destructive' onClick={handleConfirmLeave}>{isSpace ? t('Leave Space') : t('Leave Group')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
