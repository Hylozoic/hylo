import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, waitFor, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import SupportHyloModal from './SupportHyloModal'

const supportHylo = {
  checkAvailable: true,
  supporterStatus: 'none',
  showSupporterBadge: false,
  hasIncognitoContributions: false,
  manualGrant: false,
  manualGrantExpiresAt: null,
  contributions: [],
  adminGroups: [{ id: '7', name: 'Garden Club', slug: 'garden', avatarUrl: null }]
}

describe('SupportHyloModal', () => {
  let intentVariables

  beforeEach(() => {
    intentVariables = null
    mockGraphqlServer.use(
      graphql.query('SupportHylo', () => HttpResponse.json({ data: { supportHylo } })),
      graphql.mutation('CreateSupportIntent', ({ variables }) => {
        intentVariables = variables
        return HttpResponse.json({ data: { createSupportIntent: { token: 'tok', tag: 'hylo-tok' } } })
      })
    )
  })

  it('lets you count your support for a group you administer and opens Open Collective with the presets', async () => {
    const navigate = jest.fn()
    render(<SupportHyloModal open onOpenChange={() => {}} navigate={navigate} />)

    const select = screen.getByTestId('support-attribution')
    expect(await screen.findByRole('option', { name: 'Me and Garden Club' })).toBeInTheDocument()
    fireEvent.change(select, { target: { value: '7' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Yearly' }))
    fireEvent.click(screen.getByRole('button', { name: '$50' }))
    fireEvent.click(screen.getByTestId('support-hylo-continue'))

    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(intentVariables).toEqual({ groupId: '7' })
    const url = new URL(navigate.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://opencollective.com/hylo/donate')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      amount: '50',
      interval: 'year',
      tags: 'hylo-tok',
      redirect: `${window.location.origin}/support/thanks`
    })
  })

  it('defaults to just me, monthly', async () => {
    const navigate = jest.fn()
    render(<SupportHyloModal open onOpenChange={() => {}} navigate={navigate} />)
    fireEvent.click(screen.getByTestId('support-hylo-continue'))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(intentVariables).toEqual({ groupId: null })
    expect(new URL(navigate.mock.calls[0][0]).searchParams.get('interval')).toBe('month')
  })

  it('shows an error and stays open when the intent cannot be created', async () => {
    mockGraphqlServer.use(
      graphql.mutation('CreateSupportIntent', () => HttpResponse.json({ errors: [{ message: 'nope' }] }))
    )
    const navigate = jest.fn()
    render(<SupportHyloModal open onOpenChange={() => {}} navigate={navigate} />)
    fireEvent.click(screen.getByTestId('support-hylo-continue'))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't start your contribution")
    expect(navigate).not.toHaveBeenCalled()
  })
})
