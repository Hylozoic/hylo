import React, { useEffect, useState } from 'react'
import { Link, useHistory } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import ReactCodeInput from 'react-code-input'
import { formatError } from '../../util'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { verifyEmail } from '../Signup.store'
import Loading from 'components/Loading'
import '../Signup.scss'

export default function VerifyEmail (props) {
  const history = useHistory()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const email = currentUser?.email || getQuerystringParam('email', null, props)
  const token = getQuerystringParam('token', null, props)
  const [error, setError] = useState()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) { submit() }
  }, [])

  if (!email) {
    history.push('/signup')
    return null
  }

  const submit = async value => {
    try {
      setLoading(true)

      const result = await dispatch(verifyEmail(email, value || code, token))
      const error = result.payload.data.verifyEmail?.error

      if (error) {
        setError(error)
      }
    } catch (requestError) {
      // Error is added to the state by login reducer but we need to catch it here too
      history.push(`/signup?error=${requestError.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Loading />
    )
  }

  const handleChange = (value) => {
    if (value.length === 6) {
      submit(value)
    }
    setCode(value)
  }

  return (
    <div styleName='form'>
      <Link to='/signup' styleName='back-button'>&#8592; back</Link>
      <div styleName='formWrapper'>
        <h1 styleName='title'>Check your email</h1>
        <p styleName='sub-header'>We've sent a 6 digit code to {email}. The code will expire shortly, so please enter it here soon.</p>
        {error && formatError(error, 'Signup')}
        <div styleName='codeWrapper'>
          <ReactCodeInput type='text' fields={6} onChange={handleChange} />
        </div>
      </div>
    </div>
  )
}
