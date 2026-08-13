import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import { Switch } from 'components/ui/switch'

export default function SettingsToggles ({ id, settings, update, label, stacked = false }) {
  const { t } = useTranslation()

  return (
    <div className={cn(
      'flex',
      stacked ? 'flex-col items-start gap-2' : 'items-center justify-between'
    )}
    >
      {label && <span className='inline-flex items-center'>{label}</span>}
      <div className={cn('flex items-center gap-4', { 'flex-col items-start gap-1': stacked })}>
        <div className='flex items-center gap-1'>
          <Switch
            id={`${id}-push-notifications`}
            checked={settings.sendPushNotifications}
            onCheckedChange={value => update({ sendPushNotifications: value })}
          />
          <label htmlFor={`${id}-push-notifications`}>{t('Mobile Push')}</label>
        </div>
        <div className='flex items-center gap-1'>
          <Switch
            id={`${id}-email-notifications`}
            checked={settings.sendEmail}
            onCheckedChange={value => update({ sendEmail: value })}
          />
          <label htmlFor={`${id}-email-notifications`}>{t('Email')}</label>
        </div>
      </div>
    </div>
  )
}
