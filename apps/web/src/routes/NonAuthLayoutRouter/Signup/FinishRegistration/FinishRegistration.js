import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import getMe from 'store/selectors/getMe'
import { register } from '../Signup.store'
import logout from 'store/actions/logout'
import Button from 'components/Button'
import Icon from 'components/Icon'
import TextInput from 'components/TextInput'
import { formatError } from '../../util'
import { cn } from 'util/index'

export default function FinishRegistration () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const currentUser = useSelector(getMe)
  const [error, setError] = useState()
  const email = currentUser?.email
  const name = currentUser?.name
  const [formValues, setFormValues] = useState({
    name: name || '',
    password: '',
    passwordConfirmation: ''
  })
  const canSubmit = formValues.name.length > 1 &&
    formValues.password.length > 8 &&
    formValues.passwordConfirmation.length > 8

  const handleCancel = () => {
    if (window.confirm(t("We're almost done, are you sure you want to cancel?"))) {
      dispatch(logout()).then(() => {
        navigate('/signup')
      })
    }
  }

  const handleSubmit = async () => {
    try {
      if (formValues.password !== formValues.passwordConfirmation) {
        setError(t("Passwords don't match"))
      } else {
        const result = await dispatch(register(formValues.name, formValues.password))
        const error = result?.payload?.getData()?.error

        if (error) setError(error)
      }
    } catch (responseError) {
      setError(responseError.message)
    }
  }

  const handleChange = (e) => {
    const name = e.target.name
    const value = e.target.value

    setError(null)
    setFormValues(prevState => ({ ...prevState, [name]: value }))
  }

  return (
    <div className='bg-background shadow-lg rounded-lg w-[320px]'>
      <div className='relative'>
        <Icon
          name='Ex'
          className='absolute top-2 right-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground transition-colors'
          onClick={handleCancel}
        />
        <div className='p-6'>
          <h1 className='text-2xl font-bold text-foreground text-center mb-2'>{t('One more step!')}</h1>
          <p className='text-sm text-muted-foreground text-center mb-5'>
            {t('{{email}} was successfully added to your profile.', { email })}
          </p>
          <p className='text-sm text-muted-foreground text-center mb-5'>{t('Please enter a name and password to secure your account.')}</p>

          {error && formatError(error, 'Signup', t)}

          <TextInput
            aria-label='name'
            autoFocus
            id='name'
            internalLabel={t('Name')}
            label='name'
            name='name'
            onChange={handleChange}
            className='mb-5'
            type='text'
            value={formValues.name}
          />

          <TextInput
            aria-label='password'
            autoComplete='off'
            id='password'
            internalLabel={t('Password (at least 9 characters)')}
            label='password'
            name='password'
            onChange={handleChange}
            className='mb-5'
            type='password'
            value={formValues.password}
          />

          <TextInput
            aria-label='passwordConfirmation'
            autoComplete='off'
            id='passwordConfirmation'
            internalLabel={t('Confirm Password')}
            label='passwordConfirmation'
            name='passwordConfirmation'
            onChange={handleChange}
            onEnter={handleSubmit}
            className='mb-5'
            type='password'
            value={formValues.passwordConfirmation}
          />

          <Button
            className={cn(
              'w-full text-center rounded-2xl flex items-center justify-center px-5 py-2 transition-colors',
              canSubmit ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
            label={t('Jump in to Hylo!')}
            onClick={canSubmit ? () => handleSubmit() : null}
          />
        </div>
      </div>
    </div>
  )
}
