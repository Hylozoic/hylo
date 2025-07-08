import { push } from 'redux-first-history'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatError } from 'routes/NonAuthLayoutRouter/util'
import TextInput from 'components/TextInput'
import Button from 'components/ui/button'
import { getAuthorized } from 'store/selectors/getAuthState'
import { login } from './Login.store'

export default function Login (props) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const params = useParams()

  const oauthUID = params.uid

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const isAuthorized = useSelector(getAuthorized)

  useEffect(() => {
    // If already authenticated then do the oAuth login with current session user
    if (isAuthorized) {
      submit()
    }
  }, [])

  const submit = async () => {
    try {
      const { payload } = await dispatch(login(oauthUID, email, password))
      const { redirectTo } = payload
      if (redirectTo) {
        window.location.href = redirectTo
      } else {
        dispatch(push('/'))
      }
    } catch (e) {
      setError(e.message)
    }
  }

  // TODO: let people log in with Google to login with Hylo? 🤪
  // loginAndRedirect = (service) => {
  //   this.props.loginWithService(service)
  //     .then(({ error }) => error || this.props.redirectOnSignIn('/'))
  // }

  const handleSetEmail = (e) => {
    setEmail(e.target.value)
  }

  const handleSetPassword = (e) => {
    setPassword(e.target.value)
  }

  return isAuthorized
    ? <div className='bg-background w-full max-w-[320px]'>{t('Already logged in, redirecting...')}</div>
    : (
      <div className='bg-card shadow-md rounded-md w-full max-w-[320px]'>
        <div className='p-4'>
          <h1 className='text-2xl font-bold mb-4 text-foreground text-center'>{t('Sign in to Hylo')}</h1>
          {error && formatError(error, 'Login')}

          <TextInput
            aria-label='email'
            label='email'
            name='email'
            id='email'
            autoFocus
            internalLabel='Email'
            onChange={handleSetEmail}
            className='bg-input rounded-md mb-3 border-2 border-border'
            inputClassName='p-4 autofill:text-foreground text-foreground autofill:bg-transparent w-full bg-transparent rounded-md'
            type='text'
            value={email}
          />

          <TextInput
            aria-label='password'
            label='password'
            name='password'
            id='password'
            internalLabel='Password'
            onChange={handleSetPassword}
            onEnter={submit}
            className='bg-input rounded-md mb-3 border-2 border-border'
            inputClassName='p-4 autofill:text-foreground text-foreground autofill:bg-transparent w-full bg-transparent rounded-md'
            type='password'
            value={password}
          />
          <Link to='/reset-password' className='text-sm inline-block float-right clear-both mb-2 mt-1'>
            <span className='text-focus'>{t('Forgot password?')}</span>
          </Link>

          <Button variant='highVisibility' className='w-full' onClick={submit}>
            {t('Sign in')}
          </Button>
        </div>

        {/* <div className={classes.authButtons}>
          <GoogleButton onClick={() => this.loginAndRedirect('google')} />
        </div> */}
      </div>
      )
}
