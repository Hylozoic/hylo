import { cn } from 'util/index'
import { isEmpty } from 'lodash'
import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import useRouteParams from 'hooks/useRouteParams'

import Button from 'components/Button'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
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

// The emailed settings page's unsubscribe choices (D35). 'all_but_direct' is preselected.
export const UNSUBSCRIBE_SCOPES = ['digest_only', 'no_group_emails', 'all_but_direct', 'everything']
export const DEFAULT_UNSUBSCRIBE_SCOPE = 'all_but_direct'

export default function ManageNotifications (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const userName = routeParams.name
  const token = routeParams.token

  const [settings, setSettings] = useState({ allGroupNotifications: 'keep' })
  const [changedSettings, setChangedSettings] = useState({})
  const [scopeChoice, setScopeChoice] = useState(DEFAULT_UNSUBSCRIBE_SCOPE)
  const [scopeStatus, setScopeStatus] = useState(null)

  const { commentNotifications, dmNotifications, digestFrequency, postNotifications, allGroupNotifications, unsubscribeScope } = settings
  // 'Everything' also switches off direct messages and comments, so those settings are shown as off
  const unsubscribedFromEverything = unsubscribeScope === 'everything'

  const loadSettings = () =>
    dispatch(fetchNotificationSettings(token)).then((data) => {
      const payload = data.payload || {}
      setSettings({ ...payload, allGroupNotifications: 'keep' })
      setChangedSettings({})
      setScopeChoice(UNSUBSCRIBE_SCOPES.includes(payload.unsubscribeScope) ? payload.unsubscribeScope : DEFAULT_UNSUBSCRIBE_SCOPE)
    })

  useEffect(() => {
    loadSettings()
  }, [])

  const updateSetting = setting => value => {
    setSettings({ ...settings, [setting]: value })
    setChangedSettings({ ...changedSettings, [setting]: value })
  }

  const submit = () => {
    dispatch(updateNotificationSettings(token, changedSettings))
  }

  // Only a press of the Unsubscribe (or Resubscribe) button saves a choice
  const saveScope = scope => {
    setScopeStatus(null)
    return Promise.resolve(dispatch(updateNotificationSettings(token, { unsubscribeScope: scope })))
      .then(result => {
        if (result?.error) throw new Error('not saved')
        setScopeStatus(scope === 'none' ? 'resubscribed' : 'unsubscribed')
        return loadSettings()
      })
      .catch(() => setScopeStatus('error'))
  }

  const scopeOptions = [
    { id: 'digest_only', label: t('Fewer emails (digest only)'), description: t('Digests keep coming, without an email for each new post.') },
    { id: 'no_group_emails', label: t('No group emails'), description: t('No digests or other emails from your groups. Direct messages still reach you.') },
    { id: 'all_but_direct', label: t('Everything except direct'), description: t('Only direct messages, mentions and replies to you still reach you, by email and mobile notification.') },
    { id: 'everything', label: t('Everything'), description: t('No emails or mobile notifications, apart from account and payment emails.') }
  ]
  const savedScopeOption = scopeOptions.find(option => option.id === unsubscribeScope)

  const notificationOptions = [
    { id: 'none', label: t('None') },
    { id: 'email', label: t('Email') },
    { id: 'push', label: t('Mobile App') },
    { id: 'both', label: t('Email & Mobile App') }
  ]

  const groupNotificationOptions = [{ id: 'keep', label: t('Existing per Group Settings') }, ...notificationOptions]

  return (
    <>
      <Helmet>
        <title>{t('Manage Notifications')} | Hylo</title>
      </Helmet>
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
                  value={digestFrequency}
                  onValueChange={value => updateSetting('digestFrequency')(value)}
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
                  value={postNotifications}
                  onValueChange={value => updateSetting('postNotifications')(value)}
                >
                  <SelectTrigger className='inline-flex w-auto'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>{t('No Posts (mentions still notify)')}</SelectItem>
                    <SelectItem value='important'>{t('Important Posts (Announcements, Mentions & Replies)')}</SelectItem>
                    <SelectItem value='all'>{t('Every Post')}</SelectItem>
                    {postNotifications === 'mixed' && <SelectItem value='mixed' disabled>{t('~ Mixed ~')}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className={styles.settingWrapper}>
                <label className={styles.settingExplanation}>{t('Send notifications about comments on posts you are following via')}</label>
                <Select
                  value={commentNotifications}
                  onValueChange={value => updateSetting('commentNotifications')(value)}
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
                {!unsubscribedFromEverything && (
                  <p className='text-xs text-foreground/60 mt-1 mb-0'>
                    {t('Comments that mention you still notify you, by email and push where your group settings allow.')}
                  </p>
                )}
              </div>
              <div className={styles.settingWrapper}>
                <label className={styles.settingExplanation}>{t('Send notifications for direct messages via')}</label>
                <Select
                  value={dmNotifications}
                  onValueChange={value => updateSetting('dmNotifications')(value)}
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
                  value={allGroupNotifications}
                  onValueChange={value => updateSetting('allGroupNotifications')(value)}
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

              <Button
                className={styles.submit}
                label={t('Save Settings')}
                color='green'
                onClick={submit}
              />

              <section className='mt-8 pt-6 border-t border-foreground/20' aria-labelledby='unsubscribe-heading' data-testid='unsubscribe-choices'>
                <h2 id='unsubscribe-heading' className='text-base font-bold m-0 mb-1'>{t('Unsubscribe')}</h2>
                <p className='text-xs text-foreground/60 mt-0 mb-3'>{t('Account, security and payment emails always reach you.')}</p>
                {savedScopeOption && (
                  <p className='text-sm mt-0 mb-3' data-testid='saved-unsubscribe-scope'>
                    {t('You unsubscribed from: {{choice}}', { choice: savedScopeOption.label })}
                  </p>
                )}
                <RadioGroup value={scopeChoice} onValueChange={setScopeChoice} className='gap-3'>
                  {scopeOptions.map(option => (
                    <div key={option.id} className='flex items-start gap-2'>
                      <RadioGroupItem value={option.id} id={`unsubscribe-${option.id}`} className='mt-0.5 shrink-0' />
                      <Label htmlFor={`unsubscribe-${option.id}`} className={cn('cursor-pointer font-normal leading-snug', styles.unsubscribeAllLabel)}>
                        <span className='block font-bold'>{option.label}</span>
                        <span className='block text-xs text-foreground/60'>{option.description}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                <div className='flex flex-wrap items-center gap-2 mt-4'>
                  <Button
                    label={t('Unsubscribe')}
                    color='purple'
                    onClick={() => saveScope(scopeChoice)}
                    dataTestId='unsubscribe-button'
                  />
                  {savedScopeOption && (
                    <Button
                      label={t('Resubscribe')}
                      color='green-white-green-border'
                      onClick={() => saveScope('none')}
                      dataTestId='resubscribe-button'
                    />
                  )}
                </div>
                {scopeStatus && (
                  <p className='text-sm mt-3 mb-0' role='status'>
                    {scopeStatus === 'unsubscribed' && t('Your choice is saved.')}
                    {scopeStatus === 'resubscribed' && t('You are resubscribed. The settings above apply again.')}
                    {scopeStatus === 'error' && t('Something went wrong. Please try again.')}
                  </p>
                )}
              </section>
            </div>)}
      </div>
    </>
  )
}
