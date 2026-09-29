import { CalendarPlus, Check, PenLine, UserPlus, X } from 'lucide-react'
import React, { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnalyticsEvents } from '@hylo/shared'
import { addQuerystringToPath } from '@hylo/navigation'
import InviteMembersDialog, { inviteAccessFor } from 'components/InviteMembersDialog/InviteMembersDialog'
import { updateMembershipSettings } from 'routes/UserSettings/UserSettings.store'
import fetchGroupSetupChecklist from 'store/actions/fetchGroupSetupChecklist'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from 'store/constants'
import { GROUP_TYPES } from 'store/models/Group'
import getMyGroupMembership from 'store/selectors/getMyGroupMembership'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { cn } from 'util/index'

/**
 * Whether the founder's setup checklist shows: only to the group's creator,
 * until a second member joins or someone else posts, and never again once
 * dismissed.
 */
export function setupChecklistVisible ({ checklist, dismissedAt }) {
  if (!checklist?.isCreator) return false
  if (dismissedAt) return false
  if (checklist.hasOtherMembers || checklist.hasPostByOthers) return false
  return true
}

/**
 * The checklist's items and whether each is done. Invite people is left out
 * for someone who can't invite (an Administrator without Add Members).
 */
export function setupChecklistItems (checklist, { canInvite = true } = {}) {
  return [
    canInvite && { id: 'invite', done: Boolean(checklist?.hasInvitation) },
    { id: 'welcome-post', done: Boolean(checklist?.hasCreatorPost) },
    { id: 'first-event', done: Boolean(checklist?.hasEvent) }
  ].filter(Boolean)
}

// InviteMembersDialog wraps a custom trigger in an inline span; stretch it to the row
const STRETCH_DIALOG_TRIGGER = '[&>span]:flex [&>span]:w-full'

const ICONS = {
  invite: UserPlus,
  'welcome-post': PenLine,
  'first-event': CalendarPlus
}

function ItemRow ({ item, label, onClick, ...rest }) {
  const { t } = useTranslation()
  const Icon = ICONS[item.id]
  return (
    <button
      type='button'
      onClick={onClick}
      className='w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-foreground/10 transition-colors'
      data-testid={`setup-checklist-${item.id}`}
      data-done={item.done ? 'true' : 'false'}
      {...rest}
    >
      <span
        className={cn(
          'w-5 h-5 shrink-0 rounded-full grid place-items-center border-2',
          item.done ? 'bg-selected border-selected text-white' : 'border-foreground/30 text-foreground/50'
        )}
        aria-hidden='true'
      >
        {item.done ? <Check className='w-3 h-3' /> : <Icon className='w-3 h-3' />}
      </span>
      <span className={cn('flex-1', item.done && 'text-foreground/60 line-through')}>{label}</span>
      {item.done && <span className='sr-only'>{t('Done')}</span>}
    </button>
  )
}

/**
 * Dismissible card that helps a group's founder get it going: invite people,
 * write a welcome post and add a first event, each ticked once done. Shown in
 * both group menus (the sidebar and the card menu). Dismissal is saved in the
 * founder's membership settings.
 */
export default function SetupChecklist ({ group, className }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const groupId = group?.id
  const isSpace = group?.type === GROUP_TYPES.space
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId }))
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADD_MEMBERS, groupId }))
  const canInvite = Boolean(inviteAccessFor(group, canAddMembers))
  const membership = useSelector(state => getMyGroupMembership(state, group?.slug))
  const checklist = group?.setupChecklist
  const dismissedAt = membership?.settings?.setupChecklistDismissedAt
  const visible = setupChecklistVisible({ checklist, dismissedAt })
  // Once it can't show again there is nothing to fetch: dismissed, someone
  // else joined or posted, or not the founder. Most groups never need it
  const settled = Boolean(
    dismissedAt ||
    group?.memberCount > 1 ||
    (checklist && !setupChecklistVisible({ checklist }))
  )

  // Refreshed when a composer or dialog closes (the URL changes), so items tick
  useEffect(() => {
    if (!groupId || !canAdminister || isSpace || settled) return
    dispatch(fetchGroupSetupChecklist(groupId))
  }, [dispatch, groupId, canAdminister, isSpace, settled, location.pathname, location.search])

  const trackedGroupRef = useRef(null)
  useEffect(() => {
    if (!visible || trackedGroupRef.current === groupId) return
    trackedGroupRef.current = groupId
    dispatch(trackAnalyticsEvent(AnalyticsEvents.GROUP_SETUP_CHECKLIST_SHOWN, { groupId }))
  }, [dispatch, visible, groupId])

  const trackItem = useCallback(item => {
    dispatch(trackAnalyticsEvent(AnalyticsEvents.GROUP_SETUP_CHECKLIST_ITEM_CLICKED, { groupId, item: item.id, done: item.done }))
  }, [dispatch, groupId])

  const openComposer = useCallback((item, params) => {
    trackItem(item)
    navigate(addQuerystringToPath(location.pathname, { create: 'post', ...params }))
  }, [trackItem, navigate, location.pathname])

  const dismiss = useCallback(() => {
    dispatch(trackAnalyticsEvent(AnalyticsEvents.GROUP_SETUP_CHECKLIST_DISMISSED, { groupId }))
    dispatch(updateMembershipSettings(groupId, { setupChecklistDismissedAt: new Date().toISOString() }))
  }, [dispatch, groupId])

  if (!visible) return null

  const items = setupChecklistItems(checklist, { canInvite })
  const itemById = Object.fromEntries(items.map(item => [item.id, item]))
  const doneCount = items.filter(item => item.done).length

  return (
    <section
      className={cn('rounded-xl border border-foreground/15 bg-card p-3 shadow-sm', className)}
      aria-labelledby='setup-checklist-title'
      data-testid='setup-checklist'
    >
      <div className='flex items-start justify-between gap-2 mb-1'>
        <div className='min-w-0'>
          <h3 id='setup-checklist-title' className='m-0 text-sm font-bold text-foreground'>{t('Get your group started')}</h3>
          <p className='m-0 mt-0.5 text-xs text-foreground/60'>{t('{{done}} of {{total}} done', { done: doneCount, total: items.length })}</p>
        </div>
        <button
          type='button'
          onClick={dismiss}
          aria-label={t('Dismiss setup checklist')}
          className='shrink-0 p-1 rounded-md text-foreground/50 hover:text-foreground hover:bg-foreground/10'
          data-testid='setup-checklist-dismiss'
        >
          <X className='w-4 h-4' />
        </button>
      </div>
      <ul className='m-0 p-0 list-none flex flex-col gap-0.5'>
        {itemById.invite && (
          <li className={STRETCH_DIALOG_TRIGGER}>
            <InviteMembersDialog group={group} alwaysVisible>
              <ItemRow item={itemById.invite} label={t('Invite people')} onClick={() => trackItem(itemById.invite)} />
            </InviteMembersDialog>
          </li>
        )}
        <li>
          <ItemRow item={itemById['welcome-post']} label={t('Write a welcome post')} onClick={() => openComposer(itemById['welcome-post'], { template: 'welcome' })} />
        </li>
        <li>
          <ItemRow item={itemById['first-event']} label={t('Add a first event')} onClick={() => openComposer(itemById['first-event'], { newPostType: 'event' })} />
        </li>
      </ul>
    </section>
  )
}
