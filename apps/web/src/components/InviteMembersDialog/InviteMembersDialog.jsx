import { UserPlus } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Icon from 'components/Icon'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from 'components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import InviteSettingsTab from 'routes/GroupSettings/InviteSettingsTab'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { hueOf, viewCardColor } from 'routes/AuthLayoutRouter/components/ContextMenu/viewCardTheme'
import { RESP_ADD_MEMBERS } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { cn } from 'util/index'

const INVITE_ICON_HUE = hueOf(viewCardColor({ type: null }))

/**
 * Invite trigger: UserPlus (or custom children) opens a modal with the full
 * invite page — share links, people search, email invites, and pending invites.
 * Shown only when the user can add members.
 */
export default function InviteMembersDialog ({
  group,
  parentGroup,
  className,
  triggerClassName,
  triggerLabel,
  /** When false, parent should use `group` so this fades in on hover. */
  alwaysVisible = false,
  children
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADD_MEMBERS,
    groupId: group?.id
  }))
  const [open, setOpen] = useState(false)

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen)
    if (nextOpen) dispatch(toggleNavMenu(false))
  }

  if (!canAddMembers || !group?.id) return null

  const defaultTrigger = (
    <button
      type='button'
      aria-label={t('Invite Members')}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-1 transition-all',
        'hover:scale-110 hover:bg-background/20',
        !alwaysVisible && !open && '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100',
        (alwaysVisible || open) && 'opacity-100',
        className,
        triggerClassName
      )}
    >
      <UserPlus className='w-4 h-4' />
      {triggerLabel && <span className='ml-1'>{triggerLabel}</span>}
    </button>
  )

  const trigger = children || defaultTrigger

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children
        ? (
          <DialogTrigger asChild>
            <span className='inline-flex' onClick={(e) => e.stopPropagation()}>
              {trigger}
            </span>
          </DialogTrigger>
          )
        : (
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                {trigger}
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent side='top'>{t('Invite Members')}</TooltipContent>
          </Tooltip>
          )}

      <DialogContent
        className='max-w-[750px] w-[calc(100%-2rem)] overflow-visible p-0 sm:p-0'
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (e.target.closest?.('[data-people-selector-dropdown]')) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (e.target.closest?.('[data-people-selector-dropdown]')) e.preventDefault()
        }}
      >
        <div className='max-h-[90vh] overflow-y-auto p-4 sm:p-6'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 pr-6'>
              <span
                className={cn(
                  'w-8 h-8 rounded-[9px] grid place-items-center shrink-0 border',
                  'bg-[hsl(var(--vh-hue)_48%_90%)] border-[hsl(var(--vh-hue)_40%_70%)] text-[hsl(var(--vh-hue)_45%_35%)]',
                  'dark:bg-[hsl(var(--vh-hue)_40%_26%)] dark:border-[hsl(var(--vh-hue)_40%_42%)] dark:text-[hsl(var(--vh-hue)_60%_82%)]'
                )}
                style={{ '--vh-hue': INVITE_ICON_HUE }}
              >
                <LucideIcon
                  name='People'
                  className='w-[18px] h-[18px]'
                  fallback={<Icon name='People' className='text-lg leading-none' />}
                />
              </span>
              {t('Invite People')}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className='sr-only'>
            {t('Invite people to {{name}}', { name: group.name })}
          </DialogDescription>
          <InviteSettingsTab group={group} parentGroup={parentGroup} inModal />
        </div>
      </DialogContent>
    </Dialog>
  )
}
