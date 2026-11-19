import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import FlagContent from './FlagContent'

// Plain elements stand in for the Radix select, which jsdom can't open
jest.mock('@/components/ui/select', () => {
  const React = require('react')
  return {
    Select: ({ children }) => React.createElement('div', { 'data-testid': 'reason-select' }, children),
    SelectTrigger: ({ children }) => React.createElement('span', null, children),
    SelectContent: ({ className, children }) =>
      React.createElement('div', { className, 'data-testid': 'reason-options' }, children),
    SelectItem: ({ children }) => React.createElement('div', null, children)
  }
})

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

  it('opens the reason list above the dialog, not behind it', () => {
    // SelectContent's own layer in components/ui/select.jsx, used when no class overrides it
    const SELECT_CONTENT_Z = 1200
    const zIndexOf = el => Number((el.getAttribute('class') || '').match(/\bz-\[(\d+)\]/)?.[1] || 0)
    render(<FlagContent {...defaultProps} />)
    const dialogZ = zIndexOf(screen.getByRole('heading', { name: 'Explanation for Flagging' }).closest('.fixed'))
    const listZ = zIndexOf(screen.getByTestId('reason-options')) || SELECT_CONTENT_Z
    expect(dialogZ).toBeGreaterThan(0)
    expect(listZ).toBeGreaterThan(dialogZ)
  })

  it('disables submit until a reason is selected', () => {
    render(<FlagContent {...defaultProps} />)
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })
})
