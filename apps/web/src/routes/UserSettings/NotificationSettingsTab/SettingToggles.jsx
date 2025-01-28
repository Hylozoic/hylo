import React from 'react'
import { Switch } from 'components/ui/switch'

export default function SettingsToggles ({ id, settings, update, label }) {
  return (
    <div className='flex items-center justify-between'>
      {label && <span>{label}</span>}
      <div className='flex items-center gap-4'>
        <div className='flex items-center gap-1'>
          <Switch
            id={`${id}-push-notifications`}
            checked={settings.sendPushNotifications}
            onCheckedChange={value => update({ sendPushNotifications: value })}
          />
          <label htmlFor={`${id}-push-notifications`}>Push Notifications</label>
        </div>
        <div className='flex items-center gap-1'>
          <Switch
            id={`${id}-email-notifications`}
            checked={settings.sendEmail}
            onCheckedChange={value => update({ sendEmail: value })}
          />
          <label htmlFor={`${id}-email-notifications`}>Email</label>
        </div>
      </div>
    </div>
  )
}
