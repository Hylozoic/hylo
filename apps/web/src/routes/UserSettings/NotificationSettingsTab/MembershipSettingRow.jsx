import React from 'react'
import { useTranslation } from 'react-i18next'
import InfoButton from 'components/ui/info'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import SettingsToggles from './SettingToggles'
import { bgImageStyle } from 'util/index'

import classes from './NotificationSettingsTab.module.scss'

export default function MembershipSettingsRow ({ membership, updateMembershipSettings }) {
  const { t } = useTranslation()

  return (
    <div className='py-3 border-b border-gray-200'>
      <div className='flex items-center'>
        <div className={classes.groupAvatar} style={bgImageStyle(membership.group.avatarUrl)} />
        <h2 className='text-xl font-bold'>{membership.group.name}</h2>
      </div>
      <SettingsToggles
        id={membership.id}
        settings={membership.settings}
        update={updateMembershipSettings}
        label={<span>Receive group notifications by <InfoButton content='This controls how you receive all notifications for this group. Including new posts (accordinding to setting below), event invitations and mentions.' /></span>}
      />
      <div className='flex items-center justify-between mt-2'>
        <span>Send new post notifications in this group for</span>
        <Select
          value={membership.settings.postNotifications}
          onValueChange={value => updateMembershipSettings({ postNotifications: value })}
        >
          <SelectTrigger className='inline-flex w-auto'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='none'>{t('No Posts')}</SelectItem>
            <SelectItem value='important'>{t('Important Posts (Announcements & Mentions)')}</SelectItem>
            <SelectItem value='all'>{t('Every Post')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className='flex items-center justify-between mt-2'>
        <span className=''>{t('Send me an email digest for this group')}</span>
        <Select
          value={membership.settings.digestFrequency}
          onValueChange={value => updateMembershipSettings({ digestFrequency: value })}
        >
          <SelectTrigger className='inline-flex w-auto'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='daily'>{t('Daily')}</SelectItem>
            <SelectItem value='weekly'>{t('Weekly')}</SelectItem>
            <SelectItem value='never'>{t('Never')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
