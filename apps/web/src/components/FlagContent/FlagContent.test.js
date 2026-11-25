import React from 'react'
import { toast } from 'sonner'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import FlagContent from './FlagContent'
import { flagReportMessage } from './flagReportMessage'

jest.mock('sonner', () => ({
  toast: { success: jest.fn() }
}))

describe('FlagContent', () => {
  const mockOnClose = jest.fn()

  const defaultProps = {
    type: 'post',
    onClose: mockOnClose,
    linkData: { id: 33, type: 'post' }
  }

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn()
    window.HTMLElement.prototype.hasPointerCapture = jest.fn()
    window.HTMLElement.prototype.releasePointerCapture = jest.fn()
  })

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

  it('names the post groups in the confirmation toast', () => {
    const t = (key, params) => key.replace('{{groups}}', params?.groups || '')
    expect(flagReportMessage(t, 'en', ['Garden Club'])).toBe('Your report has been sent to moderators of the Garden Club')
    expect(flagReportMessage(t, 'en', ['Garden Club', 'River Collective'])).toBe('Your report has been sent to moderators of the Garden Club and River Collective')
    expect(flagReportMessage(t, 'en', [])).toBe('Your report has been sent to moderators')
  })

  it('shows a toast naming the post groups when submitted', () => {
    render(<FlagContent {...defaultProps} groupNames={['Garden Club', 'River Collective']} />)
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('option', { name: 'Spam' }))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(toast.success).toHaveBeenCalledWith('Your report has been sent to moderators of the Garden Club and River Collective')
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('opens the reason list above the flagging overlay', () => {
    render(<FlagContent {...defaultProps} />)
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })

    expect(screen.getByRole('option', { name: 'Spam' })).toBeInTheDocument()
    expect(screen.getByRole('listbox').className).toEqual(expect.stringContaining('z-[1200]'))
  })
})
