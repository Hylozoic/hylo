import { ChevronDown, ChevronRight } from 'lucide-react'
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
import updateTopicFollow from 'store/actions/updateTopicFollow'
import SettingsToggles from './SettingToggles'
import { bgImageStyle } from 'util/index'

import classes from './NotificationSettingsTab.module.scss'

export default function MembershipSettingsRow ({ membership, open, updateMembershipSettings }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(open)

  const chatRooms = useMemo(() => (membership.group?.chatRooms.toModelArray() || []).filter(cr => cr.topicFollow), [membership.group?.chatRooms])

  return (
    <div id={`group-${membership.group.id}`} className='py-3 border-b border-gray-200'>
      <div className='flex items-center cursor-pointer' onClick={() => setIsOpen(!isOpen)}>
        <div className={classes.groupAvatar} style={bgImageStyle(membership.group.avatarUrl)} />
        <h2 className='text-xl font-bold flex-1'>{membership.group.name}</h2>
        {isOpen ? <ChevronDown className='w-4 h-4' /> : <ChevronRight className='w-4 h-4' />}
      </div>
      {isOpen && (
        <div className=''>
          <SettingsToggles
            id={membership.id}
            settings={membership.settings}
            update={updateMembershipSettings}
            label={<span>Receive group notifications by <InfoButton content='This controls how you receive all notifications for this group. Including new posts (accordinding to setting below), event invitations and mentions.' /></span>}
          />
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
    <div className='flex items-center justify-between mt-2' key={chatRoom.id}>
      <span><span className='text-secondary'>#{chatRoom.groupTopic.topic.name}</span> chat notifications</span>
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
