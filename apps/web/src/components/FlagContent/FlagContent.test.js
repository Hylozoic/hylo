import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import FlagContent from './FlagContent'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { submitFlagContent } from './FlagContent.store'

const mockOnClose = jest.fn()
const mockSubmitFlagContent = jest.fn((selectedCategory, explanation, linkData) => ({ type: '1' }))

jest.mock('./FlagContent.store', () => ({
  submitFlagContent: jest.fn((selectedCategory, explanation, linkData) => {
    return mockSubmitFlagContent(selectedCategory, explanation, linkData)
  })
}))

describe('FlagContent', () => {
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
  })

  it('calls onClose when close button is clicked', () => {
    render(<FlagContent {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /ex/i }))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('submits successfully with category:inappropriate', async () => {
    render(<FlagContent {...defaultProps} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inappropriate' } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  my reason  ' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    
    await waitFor(() => {
      expect(mockSubmitFlagContent).toHaveBeenCalledWith('inappropriate', 'my reason', defaultProps.linkData)
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('requires explanation for category:other', async () => {
    render(<FlagContent {...defaultProps} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'other' } })
    // fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Why was this post 'other'?")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('textbox'), { target: { value: '  my reason  ' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(mockSubmitFlagContent).toHaveBeenCalledWith('other', 'my reason', defaultProps.linkData)
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('resets state when cancel is called', async () => {
    render(<FlagContent {...defaultProps} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'other' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Why was this post 'other'?")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /ex/i }))

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
