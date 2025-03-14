import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { cn } from 'util/index'
import classes from './HyloCookieConsent.module.scss'

export default function HyloCookieConsent () {
  const { t } = useTranslation()
  const [cookieConsent, setCookieConsent] = useState(false)
  const [showCookieInfo, setShowCookieInfo] = useState(false)

  const toggleShowCookieInfo = () => {
    if (showCookieInfo) {
      setShowCookieInfo(false)
    } else {
      setShowCookieInfo(true)
    }
  }

  const acceptCookies = () => {
    setCookieConsent(true)
    localStorage.setItem('hylo-cookie-consent', 'accepted')
  }

  useEffect(() => {
    const cookieConsent = localStorage.getItem('hylo-cookie-consent')
    if (cookieConsent === 'accepted') {
      setCookieConsent(true)
    }
  }, [])

  if (cookieConsent) {
    return null
  }

  return (
    <div className={cn('fixed bottom-0 h-16 left-0 w-full flex items-center bg-foreground/30 border-t border-border px-10', { [classes.showCookieInfo]: showCookieInfo })}>
      <span className='font-bold flex-1'>
        {t('Hylo uses cookies to enhance the experience.')}
        <button className={cn(classes.viewDetails, 'ml-4')} onClick={toggleShowCookieInfo}>{t('View details')}</button>
      </span>
      <Button variant='secondary' onClick={acceptCookies}>{t('I Understand')}</Button>
      <div className={cn(classes.cookieInformation, { [classes.showCookieInfo]: showCookieInfo })}>
        <div className={classes.content}>
          <div className={classes.pad}>
            <h3>{t('How do we use cookies?')}</h3>
            <h4>{t('Hylo login & session')}</h4>
            <p>{t('We use cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo.')}</p>
            <h4>{t('Mixpanel')}</h4>
            <p>{t('We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it.')}</p>
            <h4>{t('Intercom')}</h4>
            <p>{t('When people on Hylo need help or want to report a bug, they are interacting with a service called intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team.')}</p>
            <h4>{t('Local storage & cache')}</h4>
            <p>{t('We store images, icons and application data in your browser to improve performance and load times.')}</p>
            <button className={classes.closeButton} onClick={toggleShowCookieInfo}>{t('Close')}</button>
          </div>
        </div>
        <div className={classes.bg} onClick={toggleShowCookieInfo} />
      </div>
    </div>
  )
}
