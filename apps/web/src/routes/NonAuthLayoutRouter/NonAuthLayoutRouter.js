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
import Button from 'components/ui/button'
import JoinGroup from 'routes/JoinGroup'
import Login from 'routes/NonAuthLayoutRouter/Login'
import ManageNotifications from 'routes/NonAuthLayoutRouter/ManageNotifications'
import PasswordReset from 'routes/NonAuthLayoutRouter/PasswordReset'
import SignupRouter from 'routes/NonAuthLayoutRouter/Signup/SignupRouter'
import { getLocaleFromLocalStorage, localeToFlagEmoji } from 'util/locale'

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
  const locale = getLocaleFromLocalStorage()
  const localeDisplay = localeToFlagEmoji(locale)
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const logoSrc = isDarkMode ? '/hylo-logo-light-horizontal.svg' : '/hylo-logo-dark-horizontal.svg'

  useEffect(() => {
    if (returnToPath && returnToPath !== '/') {
      // Clears location state on page reload
      navigate('.', { replace: true, state: null })
      dispatch(setReturnToPath(returnToPath))
    }

    if (isAuthenticated) {
      navigate('/signup', { replace: true })
    }
  }, [dispatch, setReturnToPath, returnToPath])

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
              <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto p-4 mt-4 text-sm'>
                <Link to='/login' className='text-foreground flex items-center justify-between gap-2'>
                  {t('Already have an account?')} <Button variant='outline'>{t('Sign in')}</Button>
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
                    <Button variant='outline'>{t('Sign up')}</Button>
                  </Link>
                  or
                  <Link to='/login' className='text-foreground'>
                    <Button variant='outline'>{t('Sign in')}</Button>
                  </Link>
                </div>
              </div>
            }
          />
          <Route
            path='/login'
            element={
              <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto p-4 mt-4 text-sm'>
                <Link className='flex items-center justify-between gap-2 text-foreground' tabIndex={-1} to='/signup'>
                  {t('Not a member of Hylo?')} <Button variant='outline'>{t('Sign Up')}</Button>
                </Link>
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
