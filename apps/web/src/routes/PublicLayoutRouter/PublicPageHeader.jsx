import React from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { useLocation } from 'react-router-dom'
import { authPathWithReturnTo } from 'util/returnToPath'

export default function PublicPageHeader () {
  const { t } = useTranslation()
  const location = useLocation()
  // Bring people back to this public page once they have signed in or signed up
  const returnToPath = location.pathname + location.search
  return (
    <div className='bg-white/10 shadow-md'>
      <Helmet>
        <title>{t('Public')} | Hylo</title>
        <meta name='description' content='Hylo: Public content' />
      </Helmet>
      <div className='w-full mx-auto px-4'>
        <div className='flex justify-between items-center h-16'>
          <a href='/'>
            <img className='h-8 dark:hidden' src='/assets/navy-merkaba.svg' alt={t('Hylo logo')} />
            <img className='h-8 hidden dark:block' src='/assets/white-merkaba.svg' alt={t('Hylo logo')} />
          </a>
          <div className='flex items-center gap-4'>
            <a href={authPathWithReturnTo('/login', returnToPath)} className='text-foreground hover:text-foreground/80 transition-colors'>{t('Sign in')}</a>
            <a href={authPathWithReturnTo('/signup', returnToPath)} className='bg-accent text-white px-4 py-2 rounded-md hover:bg-selected/90 transition-colors'>{t('Join Hylo')}</a>
          </div>
        </div>
      </div>
    </div>
  )
}
