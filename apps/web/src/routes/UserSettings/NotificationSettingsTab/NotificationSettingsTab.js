import { includes, every } from 'lodash/fp'
import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { createSelector } from 'reselect'
import Tooltip from 'components/Tooltip'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { GROUP_TYPES } from 'store/models/Group'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import GroupMembershipNotificationSettings from './GroupMembershipNotificationSettings'
import MembershipSettingsRow from './MembershipSettingRow'
import SettingsToggles from './SettingToggles'

import {
  updateMembershipSettings,
  updateAllMemberships,
  updateUserSettings
} from '../UserSettings.store'

const iOSAppURL = 'https://itunes.apple.com/app/appName/id1002185140'
const androidAppURL = 'https://play.google.com/store/apps/details?id=com.hylo.hyloandroid'

// Utility function to convert enum value to boolean flags
const convertEnumToFlags = (value) => ({
  sendEmail: includes(value, ['email', 'both']),
  sendPushNotifications: includes(value, ['push', 'both'])
})

// Utility function to convert boolean flags to enum value
const convertFlagsToEnum = ({ sendEmail, sendPushNotifications }) => {
  if (sendEmail && sendPushNotifications) return 'both'
  if (sendEmail) return 'email'
  if (sendPushNotifications) return 'push'
  return 'none'
}

// Generic function to get current settings for any notification type
const getCurrentSettings = (me, settingKey) => convertEnumToFlags(me.settings?.[settingKey])

const getAllGroupsSettings = createSelector(
  getMyMemberships,
  memberships => ({
    sendEmail: every(m => m.settings?.sendEmail, memberships),
    sendPushNotifications: every(m => m.settings?.sendPushNotifications, memberships),
    postNotifications: memberships.length > 0 && every(m => m.settings?.postNotifications === memberships[0].settings?.postNotifications, memberships)
      ? memberships[0].settings?.postNotifications
      : 'mixed',
    digestFrequency: memberships.length > 0 && every(m => m.settings?.digestFrequency === memberships[0].settings?.digestFrequency, memberships)
      ? memberships[0].settings?.digestFrequency
      : 'mixed'
  })
)

/** True when this membership is a space (child of another group). */
function isSpaceMembership (membership) {
  return membership.group?.type === GROUP_TYPES.space
}

/**
 * Split memberships into top-level groups and spaces nested under their parent.
 * Spaces whose parent is not in the list are shown as top-level rows.
 */
function nestSpaceMemberships (memberships) {
  const parentMemberships = []
  const spacesByParentId = {}
  const orphanSpaceMemberships = []

  for (const membership of memberships) {
    if (!isSpaceMembership(membership)) {
      parentMemberships.push(membership)
      continue
    }
    const parentId = membership.group?.parentId
    if (parentId == null) {
      orphanSpaceMemberships.push(membership)
      continue
    }
    const key = String(parentId)
    if (!spacesByParentId[key]) spacesByParentId[key] = []
    spacesByParentId[key].push(membership)
  }

  const parentIds = new Set(parentMemberships.map(m => String(m.group.id)))
  for (const [parentId, spaces] of Object.entries(spacesByParentId)) {
    if (!parentIds.has(parentId)) {
      orphanSpaceMemberships.push(...spaces)
      delete spacesByParentId[parentId]
    } else {
      spaces.sort((a, b) => a.group.name.localeCompare(b.group.name))
    }
  }

  return { parentMemberships, spacesByParentId, orphanSpaceMemberships }
}

function NotificationSettingsTab ({
  currentUser,
  memberships
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const me = useSelector(getMe) // Assuming getMe is a selector that fetches the current user
  const allGroupsSettings = useSelector(getAllGroupsSettings)

  // Get a group row to jump to from the query params
  const jumpToGroupId = getQuerystringParam('group', location)

  const { parentMemberships, spacesByParentId, orphanSpaceMemberships } = useMemo(
    () => nestSpaceMemberships(memberships),
    [memberships]
  )

  const updateUserSetting = settingKey => changes => {
    const currentSettings = getCurrentSettings(me, settingKey)
    const newSettings = {
      ...currentSettings,
      ...changes
    }
    const value = convertFlagsToEnum(newSettings)
    dispatch(updateUserSettings({
      settings: {
        [settingKey]: value
      }
    }))
  }

  const updateAllGroups = changes => {
    dispatch(updateAllMemberships(changes))
  }

  const updateAllGroupsAlert = (changes) => {
    const key = Object.keys(changes)[0]
    const value = changes[key]
    const numGroups = memberships.length

    if (window.confirm(t('You wish to set {{key}} to \'{{value}}\' for all groups? This will affect {{numGroups}} {{groups}}.', { key, value, numGroups, groups: numGroups === 1 ? t('group') : t('groups') }))) {
      updateAllGroups(changes)
    }
  }

  const updateSpaceMembershipSettings = (groupId, changes) => {
    dispatch(updateMembershipSettings(groupId, changes))
  }

  useEffect(() => {
    setTimeout(() => {
      const groupSection = document.getElementById(`group-${jumpToGroupId}`)
      console.log('groupSection', jumpToGroupId, groupSection)
      if (groupSection) {
        console.log('scrolling to groupSection')
        groupSection.scrollIntoView({ behavior: 'instant' })
      }
    }, 100)
  }, [jumpToGroupId])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      icon: 'Notifications',
      title: t('Notifications')
    })
  }, [setHeaderDetails])

  if (!currentUser) return <Loading />

  const hasGroupRows = parentMemberships.length > 0 || orphanSpaceMemberships.length > 0

  return (
    <div>
      <div>
        <div className='text-sm text-foreground/50 mb-2'>{t('Global notifications')}</div>
        <div className='bg-card/100 rounded-lg p-4 shadow-lg'>
          <div className='border-b-2 border-foreground/20 mb-2 py-2'>
            <SettingsToggles
              label={<span className='text-xl'><Icon name='Messages' className='mr-2' />{t('Messages')}</span>}
              settings={getCurrentSettings(me, 'dmNotifications')}
              update={updateUserSetting('dmNotifications')}
            />
          </div>
          <div className='py-2'>
            <SettingsToggles
              label={<span className='text-xl'><Icon name='Messages' className='mr-2' />{t('Comments on followed posts')}</span>}
              settings={getCurrentSettings(me, 'commentNotifications')}
              update={updateUserSetting('commentNotifications')}
            />
          </div>
        </div>
        <div className='text-sm text-foreground/50 mb-2 mt-4'>{t('Default group notifications')}</div>
        <div className='bg-card/100 rounded-lg p-4 shadow-lg mb-4'>
          <div className='flex items-center text-sm text-foreground/80 mb-2'>
            <span>{t('These settings apply to all groups. Toggling related group settings will turn off these default settings.')}</span>
          </div>
          <GroupMembershipNotificationSettings
            id='all-groups'
            settings={allGroupsSettings}
            update={updateAllGroupsAlert}
            showMixed
            receiveByInfo={t('This controls how you receive notifications for all your groups.')}
          />
        </div>
        {hasGroupRows && (
          <div>
            <div className='text-sm text-foreground/50 mb-2'>{t('Group-specific notifications')}</div>
            {parentMemberships.map(membership => {
              const spaceMemberships = spacesByParentId[String(membership.group.id)] || []
              const open = String(membership.group.id) === String(jumpToGroupId) ||
                spaceMemberships.some(s => String(s.group.id) === String(jumpToGroupId))
              return (
                <div key={membership.id}>
                  <MembershipSettingsRow
                    membership={membership}
                    open={open}
                    updateMembershipSettings={changes => dispatch(updateMembershipSettings(membership.group.id, changes))}
                    spaceMemberships={spaceMemberships}
                    updateSpaceMembershipSettings={updateSpaceMembershipSettings}
                  />
                </div>
              )
            })}
            {orphanSpaceMemberships.map(membership => (
              <div key={membership.id}>
                <MembershipSettingsRow
                  membership={membership}
                  open={String(membership.group.id) === String(jumpToGroupId)}
                  updateMembershipSettings={changes => dispatch(updateMembershipSettings(membership.group.id, changes))}
                />
              </div>
            ))}
          </div>
        )}

      </div>

      <div className='my-8'>
        <p className='text-sm text-foreground/100'>
          {t('Download our')}{' '}<a href={iOSAppURL} rel='noreferrer' target='_blank' className='text-focus hover:text-selected/100 visited:text-focus/80'>iOS</a>
          {' '}{t('or')}{' '}
          <a href={androidAppURL} rel='noreferrer' target='_blank' className='text-focus hover:text-selected/100 visited:text-focus/80'>Android</a>
          {t(' app to receive push notifications.')}
        </p>
      </div>

      <Tooltip
        delay={250}
        id='helpTip'
        position='top'
      />
    </div>
  )
}

export default NotificationSettingsTab
