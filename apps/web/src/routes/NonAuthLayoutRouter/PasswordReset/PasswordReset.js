import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import validator from 'validator'
import Button from 'components/ui/Button'
import TextInput from 'components/TextInput'
import { cn } from 'util/index'

function PasswordReset ({ className, sendPasswordReset }) {
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(false)
  const emailRef = useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    setTimeout(() => {
      emailRef.current?.focus()
    }, 100)
  }, [])

  const submit = () => {
    sendPasswordReset(email)
      .then(({ error }) => {
        if (error) {
          setError(true)
          setSuccess(false)
        } else {
          setSuccess(true)
          setError(false)
        }
      })
  }

  const onChange = event => {
    setEmail(event.target.value)
    setSuccess(false)
    setError(false)
  }

  const canSubmit = validator.isEmail(email)

  return (
    <>
      <Helmet>
        <title>{t('Reset your Hylo password')}</title>
      </Helmet>
      <div className={className}>
        <div className='bg-background/100 rounded-md p-4 w-full max-w-[320px] mx-auto'>
          <h1 className='text-2xl font-bold mb-4 text-foreground text-center'>{t('Reset your password')}</h1>
          <div className='mb-4 text-foreground/80 text-center'>
            {t("Enter your email address and we'll send you an email that lets you reset your password.")}
          </div>
          {success && <div className='mb-4 text-selected text-center'>{t('If your email address matched an account in our system, we sent you an email. Please check your inbox.')}</div>}
          {error && <div className='mb-4 text-error text-center'>{t('There was a problem with your request. Please check your email and try again.')}</div>}
          <TextInput
            id='email'
            internalLabel={t('Your email address')}
            autoFocus
            inputRef={emailRef}
            name='email'
            noClearButton
            onChange={onChange}
            onEnter={submit}
            className='bg-input rounded-md mb-3 selected:text-foreground'
            inputClassName='p-3 text-foreground bg-input w-full rounded-md autofill:text-foreground autofill:bg-transparent selected:text-foreground'
            type='text'
            value={email}
          />

          <Button
            className={cn('w-full mt-2 rounded-md p-2', { 'bg-selected': canSubmit, 'bg-foreground/10 text-foreground/80': !canSubmit })}
            onClick={canSubmit ? submit : null}
          >
            {t('Send reset email')}
          </Button>
        </div>
      </div>
    </>
  )
}

export default PasswordReset
