import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import VerificationInput from 'react-verification-input'
import { formatError } from '../../util'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { sendEmailVerification as sendEmailVerificationAction, verifyEmail } from '../Signup.store'
import Loading from 'components/Loading'

export default function VerifyEmail (props) {
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const location = useLocation()
  const email = currentUser?.email || getQuerystringParam('email', location)
  const token = getQuerystringParam('token', location)
  const [error, setError] = useState()
  const [notice, setNotice] = useState()
  const [code, setCode] = useState('')
  const [redirectTo, setRedirectTo] = useState()
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  const sendEmailVerification = async email => {
    const { payload } = await dispatch(sendEmailVerificationAction(email))
    const { success, error } = payload.getData()

    if (error) setError(error)
    if (success) {
      setNotice(t('Email verification re-sent'))
      setTimeout(() => {
        setNotice()
      }, 10000)
    }
  }

  useEffect(() => {
    if (token) submit()
  }, [])

  if (!email) return <Navigate to='/signup' replace />

  const submit = async value => {
    try {
      setLoading(true)
      const result = await dispatch(verifyEmail(email, value || code, token))
      const error = result?.payload?.getData()?.error

      if (error) setError(error)
    } catch (requestError) {
      setRedirectTo(`/signup?error=${requestError.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (value) => {
    if (value.length === 6) {
      submit(value)
    }
    setCode(value)
  }

  if (redirectTo) return <Navigate to={redirectTo} replace />

  if (loading) return <Loading />

  return (
    <div className='bg-background/100 rounded-md p-4 w-full max-w-[320px] mx-auto'>
      <Link to='/signup' className='text-foreground/80 text-sm mb-2 inline-block'>&#8592; {t('back')}</Link>
      <h1 className='text-2xl font-bold mb-4 text-foreground text-center'>{t('Check your email')}</h1>
      {notice && <p className='text-accent text-center text-sm'>{notice}</p>}
      <p className='mb-4 text-foreground/80 text-center'>{t("We've sent a 6 digit code to {{email}}. The code will expire shortly, so please enter it here soon.", { email })}</p>
      {error && formatError(error, 'Signup', t)}
      <div className='flex justify-center mb-4'>
        <VerificationInput
          autoFocus
          length={6}
          onChange={handleChange}
          classNames={{
            container: 'flex gap-2',
            character: 'w-10 h-12 rounded-md border border-foreground/20 text-2xl text-center bg-input text-foreground transition-all duration-200',
            characterInactive: 'bg-background/60',
            characterSelected: 'border-selected',
            characterFilled: 'bg-selected/20'
          }}
        />
      </div>
      <div onClick={() => sendEmailVerification(email)} className='text-sm text-foreground/80 text-center underline cursor-pointer hover:text-selected transition-colors duration-200'>{t('Resend code')}</div>
    </div>
  )
}
