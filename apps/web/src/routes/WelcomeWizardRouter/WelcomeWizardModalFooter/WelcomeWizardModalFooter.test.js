import React from 'react'
import { fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import WelcomeWizardModalFooter from './index'

describe('WelcomeWizardModalFooter', () => {
  it('continues once when a tap fires pointerdown and click', () => {
    const submit = jest.fn()
    render(<WelcomeWizardModalFooter previous={jest.fn()} submit={submit} continueText='Next' />)

    const button = screen.getByRole('button', { name: 'Next' })
    fireEvent.pointerDown(button)
    fireEvent.click(button)

    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('continues from a keyboard click', () => {
    const submit = jest.fn()
    render(<WelcomeWizardModalFooter previous={jest.fn()} submit={submit} continueText='Next' />)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(submit).toHaveBeenCalledTimes(1)
  })
})
