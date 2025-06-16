import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { cn } from 'util/index'
import classes from './HyloCookieConsent.module.scss'

export default function HyloCookieConsent () {
  const { t } = useTranslation()
  const [cookieConsent, setCookieConsent] = useState(false)
  const [showCookieInfo, setShowCookieInfo] = useState(false)

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && showCookieInfo) {
        setShowCookieInfo(false)
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [showCookieInfo])

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
    <div className={cn('HyloCookieConsent fixed bottom-0 h-16 left-0 w-full flex justify-between items-center text-foreground bg-input/80 px-2 sm:px-4 z-[1000]', { block: showCookieInfo })}>
      <span className='flex-1 text-xs sm:text-base'>
        {t('Hylo uses cookies to enhance the experience.')}
        <button className={cn('underline font-bold', 'ml-4')} onClick={toggleShowCookieInfo}>{t('View details')}</button>
      </span>
      <Button
        variant='highVisibility'
        size='default'
        onClick={acceptCookies}
        className='font-bold'
      >
        {t('I Understand')}
      </Button>
      <div className={cn('fixed bottom-0 left-0 w-full h-full bg-black/70 z-[1000] flex items-center justify-center hidden overflow-y-auto pt-16', { block: showCookieInfo })}>
        <div className='max-w-screen-md mx-auto z-[10] relative max-w-[750px] p-4 bg-midground rounded-md'>
          <div className='p-0 sm:p-4 text-xs sm:text-base'>
            <h3 className='text-2xl font-bold mb-4'>{t('How do we use cookies?')}</h3>
            <h4 className='text-lg font-bold mb-2'>{t('Hylo login & session')}</h4>
            <p>{t('We use cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo.')}</p>
            <h4 className='text-lg font-bold mb-2'>{t('Mixpanel')}</h4>
            <p>{t('We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it.')}</p>
            <h4 className='text-lg font-bold mb-2'>{t('Intercom')}</h4>
            <p>{t('When people on Hylo need help or want to report a bug, they are interacting with a service called intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team.')}</p>
            <h4 className='text-lg font-bold mb-2'>{t('Local storage & cache')}</h4>
            <p>{t('We store images, icons and application data in your browser to improve performance and load times.')}</p>
            <Button variant='outline' className='w-full justify-center' onClick={toggleShowCookieInfo}>{t('Close')}</Button>
          </div>
        </div>
        <div className='fixed bottom-0 left-0 w-full h-full bg-background/80 z-[0] flex items-center justify-center' onClick={toggleShowCookieInfo} />
      </div>
    </div>
  )
}
