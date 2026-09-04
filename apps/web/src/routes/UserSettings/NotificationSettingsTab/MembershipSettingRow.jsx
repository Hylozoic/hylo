import { Settings, X } from 'lucide-react'
import { cn, bgImageStyle } from 'util/index'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import GroupMembershipNotificationSettings from './GroupMembershipNotificationSettings'

import classes from './NotificationSettingsTab.module.scss'

const SELECT_ITEM_CLASS = 'pl-2 pr-8 [&>span:first-child]:left-auto [&>span:first-child]:right-2'

/**
 * Expandable notification settings for one group membership, with child space
 * memberships listed underneath as single post-notification rows.
 */
export default function MembershipSettingsRow ({
  membership,
  open,
  updateMembershipSettings,
  spaceMemberships = [],
  updateSpaceMembershipSettings
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(open)

  return (
    <div id={`group-${membership.group.id}`} className={cn('p-4 bg-card/60 hover:bg-card/100 rounded-lg shadow-lg mb-2 scale-100 hover:scale-102 transition-all group', { 'bg-card/100': isOpen })}>
      <div className='flex items-center cursor-pointer' onClick={() => setIsOpen(!isOpen)}>
        <div className={classes.groupAvatar} style={bgImageStyle(membership.group.avatarUrl)} />
        <h2 className='text-xl font-bold flex-1'>{membership.group.name}</h2>
        {isOpen ? <X className='w-6 h-6' /> : <Settings className='w-6 h-6 opacity-50 group-hover:opacity-100 transition-all' />}
      </div>
      {isOpen && (
        <div className='mt-2'>
          <GroupMembershipNotificationSettings
            id={membership.id}
            settings={membership.settings}
            update={updateMembershipSettings}
          />
          {spaceMemberships.length > 0 && (
            <div className='mt-2 border-t-2 border-foreground/20 pt-1'>
              <div className='text-xs text-foreground/50 pt-2 pb-1'>{t('Spaces')}</div>
              {spaceMemberships.map(spaceMembership => (
                <div
                  key={spaceMembership.id}
                  id={`group-${spaceMembership.group.id}`}
                  className='flex items-center justify-between gap-2 py-2'
                >
                  <div className='flex items-center gap-2 min-w-0'>
                    <LucideIcon
                      name={spaceMembership.group.icon || 'Layers'}
                      className='w-5 h-5 shrink-0 text-foreground/70'
                    />
                    <span className='truncate'>{spaceMembership.group.name}</span>
                  </div>
                  <Select
                    value={spaceMembership.settings.postNotifications}
                    onValueChange={value => updateSpaceMembershipSettings(spaceMembership.group.id, { postNotifications: value })}
                  >
                    <SelectTrigger className='inline-flex w-auto min-w-[7rem] px-2 shrink-0'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className='!z-[300]'>
                      <SelectItem value='none' className={SELECT_ITEM_CLASS}>{t('No Posts')}</SelectItem>
                      <SelectItem value='important' className={SELECT_ITEM_CLASS}>{t('Important Posts (Announcements & Mentions)')}</SelectItem>
                      <SelectItem value='all' className={SELECT_ITEM_CLASS}>{t('Every Post')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
