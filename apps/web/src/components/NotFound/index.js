import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import classes from './NotFound.module.scss'

function NotFound ({ className }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleGoBack = () => {
    navigate('/')
  }

  return (
    <div className={cn(classes.container, className)}>
      <h3>{t('Oops, there\'s nothing to see here.')}</h3>
      <button type='button' className={cn(classes.goBack, 'text-focus hover:text-selected')} onClick={handleGoBack}>{t('Go back')}</button>
      <div className={classes.axolotl} />
      <span className={classes.footer}>{t('404 Not Found')}</span>
    </div>
  )
}

export default NotFound
