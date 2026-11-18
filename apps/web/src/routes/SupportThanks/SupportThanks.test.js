import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { useLocation } from 'react-router-dom'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import SupportThanks from './SupportThanks'

function mockConfirm (response) {
  const calls = []
  mockGraphqlServer.use(
    graphql.mutation('ConfirmSupportIntent', ({ variables }) => {
      calls.push(variables)
      return HttpResponse.json(response)
    })
  )
  return calls
}

describe('SupportThanks', () => {
  afterEach(() => {
    useLocation.mockReturnValue({ pathname: '', search: '' })
  })

  it('confirms the order id Open Collective sent back and names the group it counts for', async () => {
    useLocation.mockReturnValue({ pathname: '/support/thanks', search: '?orderId=1&orderIdV2=abc-123&status=PAID' })
    const calls = mockConfirm({ data: { confirmSupportIntent: { outcome: 'confirmed', supporterStatus: 'supporter', group: { id: '7', name: 'Garden Club', slug: 'garden' } } } })
    render(<SupportThanks />)
    expect(await screen.findByText('Your contribution is linked to your account and counts for Garden Club too.')).toBeInTheDocument()
    expect(screen.getByTestId('support-thanks')).toHaveAttribute('data-status', 'confirmed')
    expect(calls).toEqual([{ orderId: 'abc-123' }])
  })

  it('explains a pending contribution', async () => {
    useLocation.mockReturnValue({ pathname: '/support/thanks', search: '?orderIdV2=abc' })
    mockConfirm({ data: { confirmSupportIntent: { outcome: 'pending', supporterStatus: 'none', group: null } } })
    render(<SupportThanks />)
    expect(await screen.findByText(/still processing your contribution/)).toBeInTheDocument()
  })

  it('says linking is not available yet when Open Collective is not configured', async () => {
    useLocation.mockReturnValue({ pathname: '/support/thanks', search: '?orderIdV2=abc' })
    mockConfirm({ errors: [{ message: 'not configured', extensions: { code: 'OPEN_COLLECTIVE_NOT_CONFIGURED' } }] })
    render(<SupportThanks />)
    expect(await screen.findByText(/isn't available yet/)).toBeInTheDocument()
    expect(screen.getByTestId('support-thanks')).toHaveAttribute('data-status', 'notConfigured')
  })

  it('reassures on other errors', async () => {
    useLocation.mockReturnValue({ pathname: '/support/thanks', search: '?orderIdV2=abc' })
    mockConfirm({ errors: [{ message: 'mismatch', extensions: { code: 'SUPPORT_INTENT_MISMATCH' } }] })
    render(<SupportThanks />)
    expect(await screen.findByText(/matched automatically within a day/)).toBeInTheDocument()
  })

  it('just thanks people when there is no order id', () => {
    useLocation.mockReturnValue({ pathname: '/support/thanks', search: '' })
    render(<SupportThanks />)
    expect(screen.getByTestId('support-thanks')).toHaveAttribute('data-status', 'missing')
    expect(screen.getAllByText('Thank you for supporting Hylo!').length).toBeGreaterThan(0)
  })
})
