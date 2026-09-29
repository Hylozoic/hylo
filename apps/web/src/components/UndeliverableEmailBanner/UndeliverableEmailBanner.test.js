import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { useNavigate } from 'react-router-dom'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import UndeliverableEmailBanner, { DISMISS_STORAGE_KEY } from './UndeliverableEmailBanner'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
  useLocation: jest.fn().mockReturnValue({ pathname: '/groups/garden', search: '' })
}))

function answer (emailUndeliverable) {
  let asked = 0
  mockGraphqlServer.use(
    graphql.query('UndeliverableEmail', () => {
      asked += 1
      return HttpResponse.json({ data: { me: { id: '1', emailUndeliverable } } })
    })
  )
  return () => asked
}

describe('UndeliverableEmailBanner', () => {
  let navigate

  beforeEach(() => {
    window.sessionStorage.clear()
    navigate = jest.fn()
    useNavigate.mockReturnValue(navigate)
  })

  it('asks someone whose address bounced to update it, linking to account settings', async () => {
    answer(true)
    render(<UndeliverableEmailBanner />)

    expect(await screen.findByText("We can't deliver email to your address")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Update email' }))
    expect(navigate).toHaveBeenCalledWith('/my/account')
  })

  it('shows nothing when the address is fine', async () => {
    const asked = answer(false)
    render(<UndeliverableEmailBanner />)

    await waitFor(() => expect(asked()).toBe(1))
    expect(screen.queryByTestId('undeliverable-email-banner')).not.toBeInTheDocument()
  })

  it('can be dismissed for the rest of the visit', async () => {
    answer(true)
    const { unmount } = render(<UndeliverableEmailBanner />)

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByTestId('undeliverable-email-banner')).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem(DISMISS_STORAGE_KEY)).toBe('1')
    unmount()

    const asked = answer(true)
    render(<UndeliverableEmailBanner />)
    await waitFor(() => expect(asked()).toBe(1))
    expect(screen.queryByTestId('undeliverable-email-banner')).not.toBeInTheDocument()
  })
})
