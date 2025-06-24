import { includes, every } from 'lodash/fp'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { createSelector } from 'reselect'
import Tooltip from 'components/Tooltip'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import InfoButton from 'components/ui/info'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
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
          <div>
            <div className='flex items-center text-sm text-foreground/80 mb-2'>
              <span>{t('These settings apply to all groups you are a member of. Any group-specific settings will override these defaults for that group.')}</span>
            </div>
            <div className='border-b-2 border-foreground/20 mb-2 py-2'>
              <SettingsToggles
                label={<span className='flex items-center'>Receive group notifications by <InfoButton content='This controls how you receive notifications for all your groups.' /></span>}
                settings={allGroupsSettings}
                update={updateAllGroupsAlert}
              />
            </div>

            <div className='flex items-center justify-between mt-2 border-b-2 border-foreground/20 pb-2'>
              <span>{t('Send new post notifications in this group for')}</span>
              <Select
                value={allGroupsSettings.postNotifications}
                onValueChange={value => updateAllGroupsAlert({ postNotifications: value })}
              >
                <SelectTrigger className='inline-flex w-auto'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>{t('No Posts')}</SelectItem>
                  <SelectItem value='important'>{t('Important Posts (Announcements & Mentions)')}</SelectItem>
                  <SelectItem value='all'>{t('Every Post')}</SelectItem>
                  <SelectItem value='mixed' disabled>{t('~ Mixed ~')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-center justify-between mt-2'>
              <span className=''>{t('Send me an email digest for this group')}</span>
              <Select
                value={allGroupsSettings.digestFrequency}
                onValueChange={value => updateAllGroupsAlert({ digestFrequency: value })}
              >
                <SelectTrigger className='inline-flex w-auto'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='daily'>{t('Daily')}</SelectItem>
                  <SelectItem value='weekly'>{t('Weekly')}</SelectItem>
                  <SelectItem value='never'>{t('Never')}</SelectItem>
                  <SelectItem value='mixed' disabled>{t('~ Mixed ~')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {memberships.length > 0 && (
          <div>
            <div className='text-sm text-foreground/50 mb-2'>{t('Group-specific notifications')}</div>
            {memberships.map(membership => (
              <div key={membership.id}>
                <MembershipSettingsRow
                  membership={membership}
                  open={membership.group.id === jumpToGroupId}
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
