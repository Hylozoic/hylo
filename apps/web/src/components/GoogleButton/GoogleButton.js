import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import classes from './GoogleButton.module.scss'

export default function GoogleButton ({
  onClick,
  signUp,
  className = ''
}) {
  const { t } = useTranslation()
  const label = t('Continue with Google')

  return (
    <a
      aria-label={label}
      tabIndex={0}
      className={cn(classes.googleButton, className)}
      onClick={onClick}
    >
      <div className={classes.googleIcon}>
        <img src='assets/btn_google_light_normal_ios.svg' className='m-0' />
      </div>
      {label}
    </a>
  )
}
