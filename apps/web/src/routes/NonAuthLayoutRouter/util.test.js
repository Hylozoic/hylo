import React from 'react'
import { render, screen } from '@testing-library/react'
import { formatError } from './util'

describe('formatError', () => {
  it('renders the login error without a translation function', () => {
    render(<div>{formatError('Incorrect email or password', 'Login')}</div>)

    expect(screen.getByText('Reset your password')).toBeInTheDocument()
  })

  it('renders a known error code without a translation function', () => {
    render(<div>{formatError('invalid-code', 'Signup')}</div>)

    expect(screen.getByText('Invalid code, please try again')).toBeInTheDocument()
  })
})
