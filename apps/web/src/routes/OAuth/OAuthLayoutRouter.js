import React from 'react'
import { Route, useLocation, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import Div100vh from 'react-div-100vh'
import Particles from 'react-tsparticles'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import particlesjsConfig from 'routes/NonAuthLayoutRouter/particlesjsConfig'
import LocaleDropdown from 'routes/AuthLayoutRouter/components/GlobalNav/LocaleDropdown/LocaleDropdown'
import OAuthConsent from 'routes/OAuth/Consent'
import OAuthLogin from 'routes/OAuth/Login'
import { localeLocalStorageSync, localeToFlagEmoji } from 'util/locale'

import classes from 'routes/NonAuthLayoutRouter/NonAuthLayoutRouter.module.scss'

const particlesStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%'
}

export default function OAuthLayoutRouter (props) {
  const { t } = useTranslation()
  const location = useLocation()
  const thisApplicationText = t('this application')
  const locale = localeLocalStorageSync()
  const localeDisplay = localeToFlagEmoji(locale)
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const logoSrc = isDarkMode ? '/hylo-logo-light-horizontal.svg' : '/hylo-logo-dark-horizontal.svg'

  return (
    <Div100vh className='w-full h-full'>
      <Helmet>
        <title>Hylo</title>
        <meta name='description' content='Prosocial Coordination for a Thriving Planet' />
      </Helmet>
      <div className='relative w-full h-full flex flex-col justify-center items-center p-2'>
        <div className={classes.particlesBackgroundWrapper}>
          <Particles options={particlesjsConfig} style={particlesStyle} />
        </div>
        <div className='flex justify-between items-center w-full px-4 absolute top-0'>
          <a href='/'>
            <img className='h-10' src={logoSrc} alt={t('Hylo logo')} />
          </a>
          <LocaleDropdown renderToggleChildren={<span className='text-foreground'>{t('Locale')}: {locale} {localeDisplay}</span>} />
        </div>
        <div className='flex flex-col items-center justify-center w-full'>
          <Routes>
            <Route path='login/:uid' element={<OAuthLogin />} />
            <Route
              path='consent/:uid/*'
              element={<OAuthConsent />}
            />
          </Routes>
        </div>

        {/* The below-container content for each route */}
        <Routes>
          <Route
            path='login/*'
            element={
              <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto p-4 mt-4'>
                <p>{t('Use your Hylo account to access {{name}}.', { name: getQuerystringParam('name', location) || thisApplicationText })}</p>
              </div>
            }
          />
          <Route
            path='consent/:uid/*'
            element={
              <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto p-4 mt-4'>
                <p>{t('Make sure you trust {{name}} with your information.', { name: getQuerystringParam('name', location) || thisApplicationText })}</p>
              </div>
            }
          />
        </Routes>
        <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto p-4 mt-4 text-center'>
          <a href='https://hylo.com/terms/' target='_blank' rel='noreferrer' className='text-foreground/100'>{t('Terms of Service')}</a> +&nbsp;
          <a href='https://hylo.com/privacy' target='_blank' rel='noreferrer' className='text-foreground/100'>{t('Privacy Policy')}</a>
        </div>
      </div>
    </Div100vh>
  )
}
