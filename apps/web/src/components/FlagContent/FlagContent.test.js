import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { toast } from 'sonner'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import FlagContent from './FlagContent'

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

// Native selects stand in for the Radix ones, which jsdom can't open
jest.mock('@/components/ui/select', () => {
  const React = require('react')
  return {
    Select: ({ value, onValueChange, children }) =>
      React.createElement('select', { value, 'data-testid': 'reason-select', onChange: e => onValueChange(e.target.value) }, children),
    SelectTrigger: () => null,
    SelectContent: ({ className, children }) =>
      React.createElement('optgroup', { label: 'reasons', className, 'data-testid': 'reason-options' }, children),
    SelectItem: ({ value, children }) => React.createElement('option', { value }, children)
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

  it("needs an explanation when the reason is 'Other'", async () => {
    const requests = []
    mockGraphqlServer.use(
      graphql.operation(({ query, variables }) => {
        requests.push({ query, variables })
        return HttpResponse.json({ data: { flagInappropriateContent: { success: true } } })
      })
    )
    render(<FlagContent {...defaultProps} />)
    fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'other' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(mockOnClose).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', expect.stringContaining('(explanation required)'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'It was a scam' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(mockOnClose).toHaveBeenCalled()
    await waitFor(() => expect(requests.some(r => r.query.includes('flagInappropriateContent'))).toBe(true))
  })

  describe('reports to Hylo staff', () => {
    it('sends a conversation report with the thread and the other person, then thanks the reporter', async () => {
      let sent = null
      mockGraphqlServer.use(
        graphql.operation(({ query, variables }) => {
          if (!query.includes('reportToStaff')) return HttpResponse.json({ data: {} })
          sent = variables.data
          return HttpResponse.json({ data: { reportToStaff: { success: true } } })
        })
      )
      render(<FlagContent type='conversation' onClose={mockOnClose} linkData={{ id: '44', type: 'thread', reportedUserId: '2' }} />)
      expect(screen.getByText('Report to Hylo')).toBeInTheDocument()
      expect(screen.getByTestId('staff-report-explainer')).toBeInTheDocument()

      fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'safety' } })
      fireEvent.click(screen.getByRole('button', { name: /submit/i }))

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Thanks. Your report went to the Hylo team.'))
      expect(sent).toEqual({ category: 'safety', text: '', messageThreadId: '44', reportedUserId: '2' })
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('sends a profile report about that person', async () => {
      let sent = null
      mockGraphqlServer.use(
        graphql.operation(({ query, variables }) => {
          if (!query.includes('reportToStaff')) return HttpResponse.json({ data: {} })
          sent = variables.data
          return HttpResponse.json({ data: { reportToStaff: { success: true } } })
        })
      )
      render(<FlagContent type='person' onClose={mockOnClose} linkData={{ id: '9', type: 'member' }} />)
      fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'spam' } })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Selling things' } })
      fireEvent.click(screen.getByRole('button', { name: /submit/i }))

      await waitFor(() => expect(sent).toEqual({ category: 'spam', text: 'Selling things', reportedUserId: '9' }))
    })

    it('says so when the report could not be sent', async () => {
      mockGraphqlServer.use(
        graphql.operation(({ query }) => {
          if (!query.includes('reportToStaff')) return HttpResponse.json({ data: {} })
          return HttpResponse.json({ errors: [{ message: 'You are not a participant in this thread' }] })
        })
      )
      render(<FlagContent type='conversation' onClose={mockOnClose} linkData={{ id: '44', type: 'thread' }} />)
      fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'abusive' } })
      fireEvent.click(screen.getByRole('button', { name: /submit/i }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Something went wrong sending your report. Please try again.'))
      expect(toast.success).not.toHaveBeenCalled()
    })
  })
})
