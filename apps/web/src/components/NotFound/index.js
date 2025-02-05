import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import classes from './NotFound.module.scss'

function NotFound ({ className }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleGoBack = () => {
    // If there's more than 2 entries in history, go back, otherwise go home
    window.history.length > 2 ? navigate(-1) : navigate('/')
  }

  return (
    <div className={cn(classes.container, className)}>
      <h3>{t('Oops, there\'s nothing to see here.')}</h3>
      <a className={classes.goBack} onClick={handleGoBack}>{t('Go back')}</a>
      <div className={classes.axolotl} />
      <span className={classes.footer}>{t('404 Not Found')}</span>
    </div>
  )
}

export default NotFound
