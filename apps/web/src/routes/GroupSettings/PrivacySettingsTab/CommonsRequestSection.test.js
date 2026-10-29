import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import CommonsRequestSection from './CommonsRequestSection'

const mockDispatch = jest.fn()
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

const baseGroup = { id: '10', name: 'Foomunity', slug: 'foo', visibility: 2, allowInPublic: false }

describe('CommonsRequestSection', () => {
  beforeEach(() => mockDispatch.mockReset())

  it('sends a request with the optional message', async () => {
    mockDispatch.mockResolvedValue({ payload: { data: { requestPublicListing: { id: '10' } } } })
    render(<CommonsRequestSection group={baseGroup} />)

    fireEvent.change(screen.getByLabelText('Tell the Hylo team about your group (optional)'), { target: { value: 'We are lovely' } })
    fireEvent.click(screen.getByTestId('commons-request-button'))

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled())
    const action = mockDispatch.mock.calls[0][0]
    expect(action.type).toBe('REQUEST_PUBLIC_LISTING')
    expect(action.graphql.variables).toEqual({ groupId: '10', message: 'We are lovely' })
  })

  it('shows a pending request instead of the form', () => {
    render(<CommonsRequestSection group={{ ...baseGroup, publicListingRequest: { status: 'pending', requestedAt: '2026-10-01T00:00:00Z' } }} />)
    expect(screen.getByTestId('commons-request-pending')).toBeInTheDocument()
    expect(screen.queryByTestId('commons-request-button')).not.toBeInTheDocument()
  })

  it('shows a denial with the reviewer note and lets the steward ask again', () => {
    render(<CommonsRequestSection group={{ ...baseGroup, publicListingRequest: { status: 'denied', requestedAt: '2026-10-01T00:00:00Z', reviewMessage: 'Add a description first' } }} />)
    expect(screen.getByTestId('commons-request-denied')).toHaveTextContent('Add a description first')
    expect(screen.getByTestId('commons-request-button')).toBeEnabled()
  })

  it('asks to save first and disables the request while Public is selected but not saved', () => {
    render(<CommonsRequestSection group={{ ...baseGroup, visibility: 1 }} />)
    expect(screen.getByTestId('commons-request-save-first')).toBeInTheDocument()
    expect(screen.getByTestId('commons-request-button')).toBeDisabled()
  })

  it('enables the request once the group is saved as Public', () => {
    render(<CommonsRequestSection group={baseGroup} />)
    expect(screen.queryByTestId('commons-request-save-first')).not.toBeInTheDocument()
    expect(screen.getByTestId('commons-request-button')).toBeEnabled()
  })

  it('says the group is already in the commons instead of offering a request', () => {
    render(<CommonsRequestSection group={{ ...baseGroup, allowInPublic: true, publicListingRequest: { status: 'approved' } }} />)
    expect(screen.getByTestId('commons-request-in-commons')).toBeInTheDocument()
    expect(screen.queryByTestId('commons-request-button')).not.toBeInTheDocument()
  })
})
