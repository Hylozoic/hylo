import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ModalFooter from './ModalFooter'

describe('ModalFooter', () => {
  it('renders correctly without a "Previous" button', () => {
    const continueText = 'Continue'
    render(
      <ModalFooter
        continueText={continueText}
        showPrevious={false}
        previous={jest.fn()}
        submit={jest.fn()}
      />
    )

    expect(screen.queryByText('Previous')).not.toBeInTheDocument()
    expect(screen.getByText(continueText)).toBeInTheDocument()
    expect(screen.getByText('or press Enter')).toBeInTheDocument()
  })

  it('renders correctly with a "Previous" button', () => {
    const continueText = 'Next'
    render(
      <ModalFooter
        continueText={continueText}
        previous={jest.fn()}
        submit={jest.fn()}
      />
    )

    expect(screen.getByText('Previous')).toBeInTheDocument()
    expect(screen.getByText(continueText)).toBeInTheDocument()
    expect(screen.getByText('or press Enter')).toBeInTheDocument()
  })
})
