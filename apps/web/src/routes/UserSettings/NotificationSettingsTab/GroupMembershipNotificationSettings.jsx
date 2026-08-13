import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import InfoButton from 'components/ui/info'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import SettingsToggles from 'routes/UserSettings/NotificationSettingsTab/SettingToggles'

const SELECT_ITEM_CLASS = 'pl-2 pr-8 [&>span:first-child]:left-auto [&>span:first-child]:right-2'

/**
 * Shared notification settings for a group membership (or all-groups defaults):
 * receive-by channels, post notifications, and email digest.
 * postNotifications also controls the hourly chat digest (all / important / none).
 *
 * @param {boolean} compact - Tighter padding/text and stacked channel toggles (popover layout)
 */
export default function GroupMembershipNotificationSettings ({
  id,
  settings,
  update,
  compact = false,
  showMixed = false,
  receiveByInfo
}) {
  const { t } = useTranslation()
  const labelClass = compact ? 'text-sm' : undefined
  const rowClass = cn(
    'flex items-center justify-between gap-2',
    compact ? 'py-2' : 'py-3',
    'border-b-2 border-foreground/20'
  )
  const lastRowClass = cn(
    'flex items-center justify-between gap-2',
    compact ? 'py-2' : 'py-3'
  )
  const infoContent = receiveByInfo || t('This controls how you receive all notifications for this group. Including new posts (according to setting below), event invitations and mentions.')

  return (
    <div>
      <div className={cn(compact ? 'py-2' : 'py-3', 'border-b-2 border-foreground/20')}>
        <SettingsToggles
          id={id}
          settings={settings}
          update={update}
          stacked={compact}
          label={
            <span className={cn(labelClass, 'inline-flex items-center gap-1')}>
              {t('Receive group notifications by')}
              <InfoButton content={infoContent} />
            </span>
          }
        />
      </div>
      <div className={rowClass}>
        <span className={labelClass}>{t('Receive new post notifications for')}</span>
        <Select
          value={settings.postNotifications}
          onValueChange={value => update({ postNotifications: value })}
        >
          <SelectTrigger className='inline-flex w-auto min-w-[7rem] px-2'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className='!z-[300]'>
            <SelectItem value='none' className={SELECT_ITEM_CLASS}>{t('No Posts')}</SelectItem>
            <SelectItem value='important' className={SELECT_ITEM_CLASS}>{t('Important Posts (Announcements & Mentions)')}</SelectItem>
            <SelectItem value='all' className={SELECT_ITEM_CLASS}>{t('Every Post')}</SelectItem>
            {showMixed && <SelectItem value='mixed' disabled>{t('~ Mixed ~')}</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      <div className={lastRowClass}>
        <span className={labelClass}>{t('Receive an email digest summarizing group activity')}</span>
        <Select
          value={settings.digestFrequency}
          onValueChange={value => update({ digestFrequency: value })}
        >
          <SelectTrigger className='inline-flex w-auto'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className='!z-[300]'>
            <SelectItem value='daily'>{t('Daily')}</SelectItem>
            <SelectItem value='weekly'>{t('Weekly')}</SelectItem>
            <SelectItem value='never'>{t('Never')}</SelectItem>
            {showMixed && <SelectItem value='mixed' disabled>{t('~ Mixed ~')}</SelectItem>}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
