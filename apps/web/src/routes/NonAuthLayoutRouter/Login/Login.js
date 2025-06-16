import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Helmet } from 'react-helmet'
import { Link, useLocation } from 'react-router-dom'
import { checkForStorageAccess, formatError } from '../util'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import checkLogin from 'store/actions/checkLogin'
import login from 'store/actions/login'
import loginWithService from 'store/actions/loginWithService'
import TextInput from 'components/TextInput'
import GoogleButton from 'components/GoogleButton'
import Button from 'components/ui/Button'
import classes from './Login.module.scss'

export default function Login (props) {
  const dispatch = useDispatch()
  const [email, setEmail] = useState()
  const [password, setPassword] = useState()
  const location = useLocation()
  const [error, setError] = useState(getQuerystringParam('error', location))
  const { t } = useTranslation()
  const DEFAULT_LOGIN_ERROR = t('Sorry, that Email and Password combination didn\'t work.')

  useEffect(() => {
    // Because chrome autofill is a pain, we need to check for it and set the email and password if it's there
    const checkAutofill = () => {
      const emailInput = document.getElementById('email')
      const passwordInput = document.getElementById('password')
      if (emailInput?.value && !email) {
        setEmail(emailInput.value)
      }
      if (passwordInput?.value && !password) {
        setPassword(passwordInput.value)
      }
    }

    const interval = setInterval(checkAutofill, 100)
    return () => clearInterval(interval)
  }, [email, password])

  const handleEmailChange = event => {
    setEmail(event.target.value)
  }

  const handlePasswordChange = event => {
    setPassword(event.target.value)
  }

  const handleLogin = async () => {
    // XXX: needed by Safari to allow for login in an iframe
    checkForStorageAccess(
      async () => {
        const { payload } = await dispatch(login(email, password))
        const { me, error } = payload.getData()

        if (error) {
          setError(error)
        }

        if (!me) {
          setError(DEFAULT_LOGIN_ERROR)
        }
      },
      () => {
        // Storage access was denied.
        console.error('Denied access to browser storage')
      }
    )
  }

  const handleLoginWithService = async service => {
    // XXX: needed by Safari to allow for login in an iframe
    checkForStorageAccess(
      async () => {
        try {
          const result = await dispatch(loginWithService(service))

          if (result?.error) {
            return setError(result.error)
          }

          // Required for Me data to be available to cause switch to auth'd
          // layout (i.e. AuthLayoutRouter)
          dispatch(checkLogin())
        } catch (error) {
          setError(error.message)
        }
      },
      () => {
        // Storage access was denied.
        setError('Denied access to browser storage')
      }
    )
  }

  return (
    <>
      <Helmet>
        <title>{t('Sign in to Hylo')}</title>
      </Helmet>
      <div className='bg-background/100 rounded-md w-full max-w-[320px] mx-auto'>
        <div className='flex flex-col gap-2 p-4'>
          <h1 className='text-2xl font-bold mb-4 text-foreground text-center'>{t('Sign in to Hylo')}</h1>

          {error && formatError(error, 'Login', t)}

          <TextInput
            aria-label='email' label='email' name='email' id='email'
            autoFocus
            internalLabel={t('Email')}
            onChange={handleEmailChange}
            doCheckAutofill
            className='bg-input rounded-md mb-3'
            inputClassName='p-3 autofill:text-foreground text-foreground autofill:bg-transparent w-full bg-transparent rounded-md'
            type='email'
            value={email || ''}
          />

          <TextInput
            aria-label='password' label='password' name='password' id='password'
            internalLabel={t('Password')}
            onChange={handlePasswordChange}
            doCheckAutofill
            onEnter={handleLogin}
            className='bg-input rounded-md mb-3'
            inputClassName='p-3 autofill:text-foreground text-foreground autofill:bg-transparent w-full bg-transparent rounded-md'
            type='password'
            value={password || ''}
          />
          <div className='flex justify-center items-center p-2'>
            <Link to='/reset-password' className={classes.forgotPassword}>
              <span className='text-focus'>{t('Forgot password?')}</span>
            </Link>
          </div>
          <Button
            variant='highVisibility'
            className={`${email && password ? 'bg-selected' : 'bg-gray-400 cursor-not-allowed'}`}
            onClick={handleLogin}
            disabled={!email || !password}
          >
            {t('Sign in')}
          </Button>
        </div>
        <div className='flex justify-center px-4 pb-4'>
          <GoogleButton onClick={() => handleLoginWithService('google')} />
        </div>
      </div>
    </>
  )
}
