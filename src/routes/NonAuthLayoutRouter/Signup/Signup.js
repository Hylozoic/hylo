import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { push } from 'connected-react-router'
import { validateEmail } from 'util/index'
import { formatError } from '../util'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { sendEmailVerification as sendEmailVerificationAction } from './Signup.store'
import loginWithService from 'store/actions/loginWithService'
import Button from 'components/Button'
import FacebookButton from 'components/FacebookButton'
import GoogleButton from 'components/GoogleButton'
import TextInput from 'components/TextInput'
import './Signup.scss'

export default function Signup (props) {
  const dispatch = useDispatch()
  const [email, setEmail] = useState()
  const [error, setError] = useState(getQuerystringParam('error', null, props))

  const sendEmailVerification = async email => {
    const { payload } = await dispatch(sendEmailVerificationAction(email))
    const { success, error } = payload.getData()
    if (success) {
      dispatch(push('/signup/verify-email?email=' + encodeURIComponent(email)))
    } else if (error) {
      setError(error)
    }
  }

  const signupAndRedirect = async service => {
    const result = await dispatch(loginWithService(service))
    if (result?.e) {
      setError(result.e)
    }
  }

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    setError()
  }

  const submit = () => {
    if (!validateEmail(email)) {
      setError('Invalid email address')
    } else {
      setError()
      sendEmailVerification(email)
    }
  }

  const canSubmit = email?.length > 0

  return (
    <div styleName='form'>
      <div styleName='formWrapper'>
        <h1 styleName='title'>Welcome to Hylo</h1>
        <p styleName='blurb'>Stay connected, organized, and engaged with your group.</p>
        <p styleName='or'>Enter your email to get started:</p>

        {error && formatError(error, 'Signup')}

        <TextInput
          aria-label='email' label='email' name='email' id='email'
          autoComplete='off'
          autoFocus
          internalLabel='Email'
          onChange={handleEmailChange}
          onEnter={submit}
          styleName='field'
          type='text'
          value={email || ''}
        />

        <Button
          styleName='submit' label='Continue' color={canSubmit ? 'green' : 'gray'}
          onClick={canSubmit ? () => submit() : null}
        />
      </div>

      <p styleName='or'>Or sign in with an existing account: </p>

      <div styleName='auth-buttons'>
        <FacebookButton onClick={() => signupAndRedirect('facebook')} />
        <GoogleButton onClick={() => signupAndRedirect('google')} />
      </div>
    </div>
  )
}
