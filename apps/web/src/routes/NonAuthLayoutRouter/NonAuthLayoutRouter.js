import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Route, Link, useLocation, useNavigate, Navigate, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import Div100vh from 'react-div-100vh'
import Particles from 'react-tsparticles'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import setReturnToPath from 'store/actions/setReturnToPath'
import { getAuthenticated } from 'store/selectors/getAuthState'
import particlesjsConfig from './particlesjsConfig'
import LocaleDropdown from 'routes/AuthLayoutRouter/components/GlobalNav/LocaleDropdown/LocaleDropdown'
import Button from 'components/Button'
import HyloCookieConsent from 'components/HyloCookieConsent'
import JoinGroup from 'routes/JoinGroup'
import Login from 'routes/NonAuthLayoutRouter/Login'
import ManageNotifications from 'routes/NonAuthLayoutRouter/ManageNotifications'
import PasswordReset from 'routes/NonAuthLayoutRouter/PasswordReset'
import SignupRouter from 'routes/NonAuthLayoutRouter/Signup/SignupRouter'
import OAuthConsent from 'routes/OAuth/Consent'
import OAuthLogin from 'routes/OAuth/Login'
import { localeLocalStorageSync, localeToFlagEmoji } from 'util/locale'

import classes from './NonAuthLayoutRouter.module.scss'

const particlesStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%'
}

export default function NonAuthLayoutRouter (props) {
  const { t } = useTranslation()
  const location = useLocation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const isAuthenticated = useSelector(getAuthenticated)
  const returnToPathFromQueryString = getQuerystringParam('returnToUrl', location)
  const returnToNavigationState = props.location?.state?.from
  const returnToPath = returnToNavigationState
    ? returnToNavigationState.pathname + returnToNavigationState.search
    : returnToPathFromQueryString
  const thisApplicationText = t('this application')
  const locale = localeLocalStorageSync()
  const localeDisplay = localeToFlagEmoji(locale)
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const logoSrc = isDarkMode ? '/hylo-logo-light-horizontal.svg' : '/hylo-logo-dark-horizontal.svg'

  useEffect(() => {
    if (returnToPath && returnToPath !== '/') {
      // Clears location state on page reload
      navigate('.', { replace: true, state: null })
      dispatch(setReturnToPath(returnToPath))
    }

    // XXX: skipAuthCheck is kind of a hack for when we are doing the oAuth login flow
    //      and we want to still show the oAuth login/consent pages even when someone is logged into Hylo
    if (!props.skipAuthCheck && isAuthenticated) {
      navigate('/signup', { replace: true })
    }
  }, [dispatch, setReturnToPath, returnToPath])

  const getPageTitle = () => {
    const path = location.pathname
    if (path.includes('/signup')) return t('Sign Up for Hylo')
    if (path.includes('/login')) return t('Sign in to Hylo')
    if (path.includes('/reset-password')) return t('Reset Password')
    if (path.includes('/notifications')) return t('Manage Notifications')
    if (path.includes('/oauth/login')) return t('OAuth Login')
    if (path.includes('/oauth/consent')) return t('OAuth Consent')
    if (path.includes('/groups/') || path.includes('/h/use-invitation')) return t('Join Group')
    return 'Hylo'
  }

  return (
    <Div100vh className='w-full h-full'>
      <Helmet>
        <title>{getPageTitle()}</title>
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
            <Route
              path='login'
              element={<Login {...props} className={classes.form} />}
            />
            <Route
              path='signup/*'
              element={<SignupRouter {...props} className={classes.form} />}
            />
            <Route
              path='reset-password'
              element={<PasswordReset {...props} className={classes.form} />}
            />
            <Route
              path='notifications'
              element={<ManageNotifications {...props} className={classes.form} />}
            />
            <Route
              path='groups/:groupSlug/join/:accessCode'
              element={<JoinGroup />}
            />
            <Route
              path='h/use-invitation'
              element={<JoinGroup />}
            />
            <Route path='oauth/login/:uid' element={<OAuthLogin className={classes.form} />} />
            <Route
              path='oauth/consent/:uid'
              element={<OAuthConsent {...props} className={classes.form} />}
            />
            {/*
              Default route
              NOTE: This passes the unmatched location for anything unmatched except `/`
              into `location.state.from` which persists navigation and will be set as the
              returnToPath in the `useEffect` in this component. This shouldn't interfere
              with the static pages as those routes are first use `path='/(.+)'` to match
              anything BUT root if there is any issue.
            */}
            <Route path='*' element={<Navigate to='/login' state={{ from: location }} replace />} />
          </Routes>
        </div>

        {/* The below-container content for each route */}
        <Routes>
          <Route
            path='signup/*'
            element={
              <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto p-4 mt-4 text-center'>
                <Link to='/login' className='text-foreground flex items-center justify-between gap-2'>
                  {t('Already have an account?')} <button className='rounded-md border-2 border-foreground/20 p-2'>{t('Sign in')}</button>
                </Link>
              </div>
            }
          />
          <Route
            path='reset-password'
            element={
              <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto p-4 mt-4 text-center'>
                <div className='flex items-center justify-center gap-2'>
                  <Link tabIndex={-1} to='/signup' className='text-foreground'>
                    <button className='rounded-md border-2 border-foreground/20 p-2'>{t('Sign Up')}</button>
                  </Link>
                  or
                  <Link to='/login' className='text-foreground'>
                    <button className='rounded-md border-2 border-foreground/20 p-2'>{t('Log In')}</button>
                  </Link>
                </div>
              </div>
            }
          />
          <Route
            path='/login'
            element={
              <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto p-4 mt-4'>
                <Link className='flex items-center justify-between gap-2 text-foreground' tabIndex={-1} to='/signup'>
                  {t('Not a member of Hylo?')} <button className='p-2 rounded-md border-2 border-foreground/20'>{t('Sign Up')}</button>
                </Link>
              </div>
            }
          />
          <Route
            path='oauth/login'
            element={
              <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto p-4 mt-4'>
                <p>{t('Use your Hylo account to access {{name}}.', { name: getQuerystringParam('name', location) || thisApplicationText })}</p>
              </div>
            }
          />
          <Route
            path='oauth/consent'
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
      <HyloCookieConsent />
    </Div100vh>
  )
}
