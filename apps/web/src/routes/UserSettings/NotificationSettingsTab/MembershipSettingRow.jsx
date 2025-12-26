import { Settings, X } from 'lucide-react'
import { cn, bgImageStyle } from 'util/index'
import React, { useCallback, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import InfoButton from 'components/ui/info'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import { Switch } from 'components/ui/switch'
import updateTopicFollow from 'store/actions/updateTopicFollow'
import SettingsToggles from './SettingToggles'

import classes from './NotificationSettingsTab.module.scss'

export default function MembershipSettingsRow ({ membership, open, updateMembershipSettings }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(open)

  const chatRooms = useMemo(() => (membership.group?.chatRooms.toModelArray() || []).filter(cr => cr.topicFollow), [membership.group?.chatRooms])
  console.log('membership.settings.sendEventRsvpEmail =', membership.settings.sendEventRsvpEmail)

  return (
    <div id={`group-${membership.group.id}`} className={cn('p-4 bg-card/60 hover:bg-card/100 rounded-lg shadow-lg mb-2 scale-100 hover:scale-102 transition-all group', { 'bg-card/100': isOpen })}>
      <div className='flex items-center cursor-pointer' onClick={() => setIsOpen(!isOpen)}>
        <div className={classes.groupAvatar} style={bgImageStyle(membership.group.avatarUrl)} />
        <h2 className='text-xl font-bold flex-1'>{membership.group.name}</h2>
        {isOpen ? <X className='w-6 h-6' /> : <Settings className='w-6 h-6 opacity-50 group-hover:opacity-100 transition-all' />}
      </div>
      {isOpen && (
        <div className='mt-2'>
          <div className='py-3 border-b-2 border-foreground/20'>
            <SettingsToggles
              id={membership.id}
              settings={membership.settings}
              update={updateMembershipSettings}
              label={<span>Receive group notifications by <InfoButton content='This controls how you receive all notifications for this group. Including new posts (accordinding to setting below), event invitations and mentions.' /></span>}
            />
          </div>
          <div className='flex items-center justify-between py-3 border-b-2 border-foreground/20'>
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
          <div className='flex items-center justify-between py-3 border-b-2 border-foreground/20'>
            <span>{t('Send me an event RSVP via email')}</span>
            <Switch
              checked={membership.settings.sendEventRsvpEmail ?? true}
              onCheckedChange={value => updateMembershipSettings({ sendEventRsvpEmail: value })}
            />
          </div>
          <div className='flex items-center justify-between py-3'>
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
          {chatRooms.map(chatRoom => <ChatRoomRow key={chatRoom.id} chatRoom={chatRoom} />)}
        </div>
      )}
    </div>
  )
}

function ChatRoomRow ({ chatRoom }) {
  const [notificationsSettings, setNotificationsSettings] = useState(chatRoom.topicFollow.settings.notifications)
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const updateNotificationsSettings = useCallback((value) => {
    setNotificationsSettings(value)
    dispatch(updateTopicFollow(chatRoom.topicFollow.id, { settings: { notifications: value } }))
  }, [chatRoom.topicFollow.id])

  return (
    <div className='flex items-center justify-between py-3 border-t-2 border-foreground/20' key={chatRoom.id}>
      <span><span className='text-secondary'>#{chatRoom.groupTopic.topic.name}</span> {t('chat notifications')}</span>
      <Select
        value={notificationsSettings}
        onValueChange={updateNotificationsSettings}
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
  )
}
