import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PasswordReset from './PasswordReset'

describe('PasswordReset', () => {
  it('renders the password reset form', () => {
    render(<PasswordReset />)

    expect(screen.getByRole('heading', { name: /Reset Your Password/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Your email address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument()
  })

  // Add more tests as needed
})
