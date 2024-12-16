import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import SettingsControl from './SettingsControl'

describe('SettingsControl', () => {
  it('renders correctly with label and value', () => {
    render(<SettingsControl label='A Control' value='the value' id='aControl'/>)

    expect(screen.getByLabelText('A Control')).toBeInTheDocument()
    expect(screen.getByDisplayValue('the value')).toBeInTheDocument()
  })

  it('renders textarea for type="textarea"', () => {
    render(<SettingsControl label='Textarea Control' type='textarea' value='textarea content' id='textareaControl'/>)

    const textarea = screen.getByRole('textbox', { name: 'Textarea Control' })
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('textarea content')
  })

  it('renders password input for type="password"', () => {
    render(<SettingsControl label='Password Control' type='password' value='secret' id='passwordControl'/>)

    const passwordInput = screen.getByLabelText('Password Control')
    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveValue('secret')
  })

  it('renders help text when provided', () => {
    render(<SettingsControl label='Help Control' helpText='This is a helpful tip' id='helpControl'/>)

    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getByText('This is a helpful tip')).toBeInTheDocument()
  })

  it('applies error class when error prop is true', () => {
    render(<SettingsControl label='Error Control' error id='errorControl' />)

    const controlLabel = screen.getByText('Error Control')
    expect(controlLabel).toHaveClass('error')
  })
})
