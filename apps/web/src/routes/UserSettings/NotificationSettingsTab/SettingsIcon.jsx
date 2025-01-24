import React from 'react'
import { useTranslation } from 'react-i18next'
import Icon from 'components/Icon'
import { cn } from 'util/index'

import classes from './NotificationSettingsTab.module.scss'

export default function SettingsIcon ({ settingKey, name, update, settings }) {
  const settingStatus = settings[settingKey] ? 'On' : 'Off'
  const { t } = useTranslation()

  return (
    <div
      className={cn(classes.settingControls, { [classes.highlightIcon]: settings[settingKey] })}
      onClick={() => update({ [settingKey]: !settings[settingKey] })}
      data-tooltip-content={`Turn ${name === 'EmailNotification' ? 'Email' : 'Mobile Push'} Notifications ${settings[settingKey] ? t('Off') : t('On')}`}
      data-tooltip-id='helpTip'
    >
      <Icon name={name} className={cn(classes.icon, { [classes.highlightIcon]: settings[settingKey] })} />
      <span className={classes.settingStatus}>{t(settingStatus)}</span>
    </div>
  )
}
