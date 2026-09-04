import { Bell } from 'lucide-react'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Popover, PopoverContent, PopoverTrigger } from 'components/ui/popover'
import GroupMembershipNotificationSettings from 'routes/UserSettings/NotificationSettingsTab/GroupMembershipNotificationSettings'
import { updateMembershipSettings } from 'routes/UserSettings/UserSettings.store'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { isSpaceGroup } from 'store/selectors/getMyGroups'

/**
 * Bell button that opens a small dropdown with this group's full notification
 * settings, so members don't have to leave the group to tweak them.
 */
export default function GroupNotificationsPopover ({ group, className = 'w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const memberships = useSelector(getMyMemberships)
  const membership = useMemo(() => memberships.find(m => m.group.id === group?.id), [memberships, group?.id])

  if (!membership) return null

  const updateSettings = changes => dispatch(updateMembershipSettings(group.id, changes))

  return (
    <Popover>
      <PopoverTrigger
        type='button'
        aria-label={t('Notification Settings')}
        className='inline-flex items-center justify-center p-0 leading-none [&>svg]:block'
      >
        <Bell className={className} />
      </PopoverTrigger>
      <PopoverContent align='start' className='w-[21rem]'>
        <h3 className='text-base font-bold mb-3'>{t('Notification Settings for {{name}}', { name: group.name })}</h3>
        <GroupMembershipNotificationSettings
          id={membership.id}
          settings={membership.settings}
          update={updateSettings}
          compact
          postsOnly={isSpaceGroup(group)}
        />
      </PopoverContent>
    </Popover>
  )
}
