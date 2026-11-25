import { cn } from 'util/index'
import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import useRouteParams from 'hooks/useRouteParams'

import Button from 'components/Button'
import Checkbox from 'components/ui/checkbox'
import { Label } from 'components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import fetchNotificationSettings from 'store/actions/fetchNotificationSettings'
import updateNotificationSettings from 'store/actions/updateNotificationSettings'

import styles from './ManageNotifications.module.scss'

// After login, the user lands on the in-app notification settings
const LOGIN_TO_NOTIFICATIONS_PATH = '/login?returnToUrl=' + encodeURIComponent('/my/notifications')

// The backend answers 403 when the emailed token is invalid or has expired
function errorStatus (error) {
  return error?.response?.status === 403 ? 'expired' : 'failed'
}

export default function ManageNotifications (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const userName = routeParams.name
  const token = routeParams.token

  const [settings, setSettings] = useState({ allGroupNotifications: 'keep' })
  const [changedSettings, setChangedSettings] = useState({})
  const [unsubscribeAll, setUnsubscribeAll] = useState(false)
  // 'loading' | 'loaded' | 'expired' | 'failed'
  const [loadStatus, setLoadStatus] = useState('loading')
  // null | 'saving' | 'saved' | 'expired' | 'failed'
  const [saveStatus, setSaveStatus] = useState(null)

  const { commentNotifications, dmNotifications, digestFrequency, postNotifications, allGroupNotifications } = settings

  useEffect(() => {
    dispatch(fetchNotificationSettings(token))
      .then(action => {
        if (action.error) throw action.payload
        setSettings({ ...action.payload, allGroupNotifications: 'keep' })
        setLoadStatus('loaded')
      })
      .catch(error => setLoadStatus(errorStatus(error)))
  }, [])

  const updateSetting = setting => value => {
    setSettings({ ...settings, [setting]: value })
    setChangedSettings({ ...changedSettings, [setting]: value })
    setSaveStatus(null)
  }

  const submit = () => {
    setSaveStatus('saving')
    dispatch(updateNotificationSettings(token, { unsubscribeAll, ...changedSettings }))
      .then(action => {
        if (action.error) throw action.payload
        setSaveStatus('saved')
      })
      .catch(error => setSaveStatus(errorStatus(error)))
  }

  const expiredMessage = (
    <div role='alert' data-testid='manage-notifications-expired' className='text-destructive text-sm my-4'>
      <p className='mb-2'>{t('This link has expired or is no longer valid.')}</p>
      <Link to={LOGIN_TO_NOTIFICATIONS_PATH} className='underline text-destructive'>
        {t('Log in to change your notification settings')}
      </Link>
    </div>
  )

  const notificationOptions = [
    { id: 'none', label: t('None') },
    { id: 'email', label: t('Email') },
    { id: 'push', label: t('Mobile App') },
    { id: 'both', label: t('Email & Mobile App') }
  ]

  const loadStatusMessage = {
    loading: t('Loading...'),
    expired: expiredMessage,
    failed: (
      <p role='alert' data-testid='manage-notifications-load-failed' className='text-destructive text-sm my-4'>
        {t('Your notification settings could not be loaded. Please try again later.')}
      </p>
    )
  }[loadStatus]

  const groupNotificationOptions = [{ id: 'keep', label: t('Existing per Group Settings') }, ...notificationOptions]

  return (
    <>
      <Helmet>
        <title>{t('Manage Notifications')} | Hylo</title>
      </Helmet>
      <div className={cn(props.className, styles.wrapper)}>
        <h1>{t('Hi {{userName}}', { userName })}</h1>
        <p>{t('You can change your Hylo notification settings here')}</p>
        {loadStatus !== 'loaded'
          ? loadStatusMessage
          : (
            <div className={styles.formWrapper}>
              <div className={styles.settingWrapper}>
                <label className={styles.settingExplanation}>{t('Send me a digest of new posts')}</label><br />
                <Select
                  value={unsubscribeAll ? 'never' : digestFrequency}
                  onValueChange={value => updateSetting('digestFrequency')(value)}
                  disabled={unsubscribeAll}
                >
                  <SelectTrigger className='inline-flex w-auto'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='daily'>{t('Daily')}</SelectItem>
                    <SelectItem value='weekly'>{t('Weekly')}</SelectItem>
                    <SelectItem value='never'>{t('Never')}</SelectItem>
                    {digestFrequency === 'mixed' && <SelectItem value='mixed' disabled>{t('~ Mixed ~')}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className={styles.settingWrapper}>
                <label className={styles.settingExplanation}>{t('Send notifications for each new post in your group?')}</label>
                <Select
                  value={unsubscribeAll ? 'none' : postNotifications}
                  onValueChange={value => updateSetting('postNotifications')(value)}
                  disabled={unsubscribeAll}
                >
                  <SelectTrigger className='inline-flex w-auto'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>{t('No Posts')}</SelectItem>
                    <SelectItem value='important'>{t('Announcements & Mentions only')}</SelectItem>
                    <SelectItem value='all'>{t('Every Post')}</SelectItem>
                    {postNotifications === 'mixed' && <SelectItem value='mixed' disabled>{t('~ Mixed ~')}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className={styles.settingWrapper}>
                <label className={styles.settingExplanation}>{t('Send notifications about comments on posts you are following via')}</label>
                <Select
                  value={unsubscribeAll ? 'none' : commentNotifications}
                  onValueChange={value => updateSetting('commentNotifications')(value)}
                  disabled={unsubscribeAll}
                >
                  <SelectTrigger className='inline-flex w-auto'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationOptions.map(option => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={styles.settingWrapper}>
                <label className={styles.settingExplanation}>{t('Send notifications for direct messages via')}</label>
                <Select
                  value={unsubscribeAll ? 'none' : dmNotifications}
                  onValueChange={value => updateSetting('dmNotifications')(value)}
                  disabled={unsubscribeAll}
                >
                  <SelectTrigger className='inline-flex w-auto'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationOptions.map(option => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.settingWrapper}>
                <label className={styles.settingExplanation}>{t('Send notifications for announcements and topic posts for all my groups via')}</label>
                <br />
                <Select
                  value={unsubscribeAll ? 'none' : allGroupNotifications}
                  onValueChange={value => updateSetting('allGroupNotifications')(value)}
                  disabled={unsubscribeAll}
                >
                  <SelectTrigger className='inline-flex w-auto'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groupNotificationOptions.map(option => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex items-center gap-2'>
                <Checkbox
                  id='unsubscribe-all'
                  checked={unsubscribeAll}
                  onCheckedChange={value => { setUnsubscribeAll(!!value); setSaveStatus(null) }}
                />
                <Label htmlFor='unsubscribe-all' className={cn('cursor-pointer font-normal', styles.unsubscribeAllLabel)}>
                  {t('Unsubscribe from all')}
                </Label>
              </div>

              <Button
                className={styles.submit}
                label={t('Save Settings')}
                color='green'
                onClick={submit}
                disabled={saveStatus === 'saving'}
              />
              {saveStatus === 'saved' && (
                <p role='status' data-testid='manage-notifications-saved' className='text-sm mt-4'>
                  {t('Your notification settings have been saved.')}
                </p>
              )}
              {saveStatus === 'expired' && expiredMessage}
              {saveStatus === 'failed' && (
                <p role='alert' data-testid='manage-notifications-save-failed' className='text-destructive text-sm mt-4'>
                  {t('Your notification settings could not be saved. Please try again.')}
                </p>
              )}
            </div>)}
      </div>
    </>
  )
}
