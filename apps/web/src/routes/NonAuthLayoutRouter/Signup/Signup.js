import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { checkForStorageAccess, formatError } from '../util'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import checkLogin from 'store/actions/checkLogin'
import { sendEmailVerification as sendEmailVerificationAction } from './Signup.store'
import loginWithService from 'store/actions/loginWithService'
import GoogleButton from 'components/GoogleButton'
import TextInput from 'components/TextInput'
import { cn, validateEmail } from 'util/index'

export default function Signup (props) {
  const dispatch = useDispatch()
  const [email, setEmail] = useState()
  const location = useLocation()
  const [error, setError] = useState(getQuerystringParam('error', location))
  const [redirectTo, setRedirectTo] = useState()
  const { t } = useTranslation()

  const sendEmailVerification = async email => {
    const { payload } = await dispatch(sendEmailVerificationAction(email))
    const { success, error } = payload.getData()

    if (error) setError(error)

    if (success) setRedirectTo(`/signup/verify-email?email=${encodeURIComponent(email)}`)
  }

  const handleSignupWithService = async service => {
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

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    setError()
  }

  const submit = () => {
    if (!validateEmail(email)) {
      setError(t('Invalid email address'))
    } else {
      // XXX: needed by Safari to allow for login in an iframe
      checkForStorageAccess(
        () => {
          setError()
          sendEmailVerification(email)
        },
        () => {
          // Storage access was denied.
          console.error('Denied access to browser storage')
        }
      )
    }
  }

  const canSubmit = email?.length > 0

  if (redirectTo) return <Navigate to={redirectTo} replace />

  return (
    <div className='bg-background/100 rounded-md p-4 w-full max-w-[320px] mx-auto'>
      <h1 className='text-2xl font-bold mb-0 text-foreground text-center'>{t('Welcome to Hylo')}</h1>
      <p className='mb-4 text-foreground/80 text-center mt-0'>{t('Enter your email to get started:')}</p>

      {error && formatError(error, 'Signup', t)}

      <TextInput
        aria-label='email'
        label='email'
        name='email'
        id='email'
        autoComplete='off'
        autoFocus
        internalLabel={t('Your email address')}
        onChange={handleEmailChange}
        onEnter={submit}
        className='bg-input rounded-md mb-3'
        inputClassName='p-3 text-foreground bg-input w-full rounded-md autofill:text-foreground autofill:bg-transparent selected:text-foreground'
        type='text'
        value={email || ''}
      />

      <button
        className={cn('w-full mt-2 rounded-md p-2 text-foreground mb-4', { 'bg-selected': canSubmit, 'bg-foreground/10 text-foreground/80': !canSubmit })}
        onClick={canSubmit ? () => submit() : null}
      >
        {t('Create account')}
      </button>

      <div className='flex justify-center'>
        <GoogleButton onClick={() => handleSignupWithService('google')} />
      </div>
    </div>
  )
}
