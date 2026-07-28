import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import FlagContent from './FlagContent'

describe('FlagContent', () => {
  const mockOnClose = jest.fn()

  const defaultProps = {
    type: 'post',
    onClose: mockOnClose,
    linkData: { id: 33, type: 'post' }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the component with correct title', () => {
    render(<FlagContent {...defaultProps} />)
    expect(screen.getByText('Explanation for Flagging')).toBeInTheDocument()
    expect(screen.getByText('Select a reason')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('calls onClose when cancel button is clicked', async () => {
    render(<FlagContent {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('disables submit until a reason is selected', () => {
    render(<FlagContent {...defaultProps} />)
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })
})
