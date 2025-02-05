import React from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'

import classes from './PublicLayoutRouter.module.scss'

export default function PublicPageHeader () {
  const { t } = useTranslation()
  return (
    <div className={classes.background}>
      <Helmet>
        <title>{t('Public')} | Hylo</title>
        <meta name='description' content='Hylo: Public content' />
      </Helmet>
      <div className={classes.wrapper}>
        <div className={classes.header}>
          <a href='/'>
            <img className={classes.logo} src='/assets/navy-merkaba.svg' alt={t('Hylo logo')} />
          </a>
          <div className={classes.accessControls}>
            <a href='/login'>{t('Sign in')}</a>
            <a className={classes.signUp} href='/signup'>{t('Join Hylo')}</a>
          </div>
        </div>
      </div>
    </div>
  )
}
