import { cn } from 'util/index'
import { isEmpty } from 'lodash'
import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'

import { useTranslation } from 'react-i18next'
import useRouteParams from 'hooks/useRouteParams'

import Button from 'components/Button'
import CheckBox from 'components/CheckBox'
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

export default function ManageNotifications (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const userName = routeParams.name
  const token = routeParams.token

  const [settings, setSettings] = useState({ allGroupNotifications: 'keep' })
  const [unsubscribeAll, setUnsubscribeAll] = useState(false)

  // TODO: switch to group settings
  const { commentNotifications, dmNotifications, digestFrequency, postNotifications, allGroupNotifications } = settings

  useEffect(() => {
    dispatch(fetchNotificationSettings(token)).then((data) => setSettings({ ...data.payload, allGroupNotifications: 'keep' }))
  }, [])

  const updateSetting = setting => value => {
    setSettings({ ...settings, [setting]: value })
  }

  const submit = () => {
    dispatch(updateNotificationSettings(token, unsubscribeAll, digestFrequency, dmNotifications, commentNotifications, postNotifications, allGroupNotifications))
  }

  const notificationOptions = [
    { id: 'none', label: t('None') },
    { id: 'email', label: t('Email') },
    { id: 'push', label: t('Mobile App') },
    { id: 'both', label: t('Email & Mobile App') }
  ]

  const groupNotificationOptions = [{ id: 'keep', label: t('Existing per Group Settings') }, ...notificationOptions]

  return (
    <div className={cn(props.className, styles.wrapper)}>
      <h1>{t('Hi {{userName}}', { userName })}</h1>
      <p>{t('You can change your Hylo notification settings here')}</p>
      {isEmpty(settings)
        ? t('Loading...')
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

            <CheckBox
              checked={unsubscribeAll}
              label={t('Unsubscribe from all')}
              onChange={value => setUnsubscribeAll(value)}
              labelClass={styles.unsubscribeAllLabel}
            />

            <Button
              className={styles.submit}
              label={t('Save Settings')}
              color='green'
              onClick={submit}
            />
          </div>)}
    </div>
  )
}
