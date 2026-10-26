import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import AtprotoIdentitySection from './AtprotoIdentitySection'

const status = (overrides = {}) => ({
  enabled: true,
  eligible: true,
  proposedHandle: 'tom.hylo.com',
  identity: null,
  ...overrides
})

const identity = { did: 'did:plc:rgljtthttmpthhoqtio7fig5', handle: 'tom.hylo.com', status: 'active', createdAt: '2026-10-27T00:00:00Z' }

function mockStatus (atproto) {
  mockGraphqlServer.use(
    graphql.query('MeAtprotoStatus', () => HttpResponse.json({ data: { me: { id: '1', atproto } } }))
  )
}

describe('AtprotoIdentitySection', () => {
  it('offers eligible users their handle and creates the identity', async () => {
    mockStatus(status())
    mockGraphqlServer.use(
      graphql.mutation('CreateAtprotoIdentity', () =>
        HttpResponse.json({ data: { createAtprotoIdentity: status({ identity }) } }))
    )
    render(<AtprotoIdentitySection />)

    expect(await screen.findByText('@tom.hylo.com')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('atproto-create-identity'))

    expect(await screen.findByText('did:plc:rgljtthttmpthhoqtio7fig5')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.queryByTestId('atproto-create-identity')).not.toBeInTheDocument()
  })

  it('shows an existing identity, including one still being set up', async () => {
    mockStatus(status({ identity: { ...identity, status: 'pending' } }))
    render(<AtprotoIdentitySection />)

    expect(await screen.findByText('@tom.hylo.com')).toBeInTheDocument()
    expect(screen.getByText('Being set up. This can take a few minutes.')).toBeInTheDocument()
  })

  it('shows the error when creating fails', async () => {
    mockStatus(status())
    mockGraphqlServer.use(
      graphql.mutation('CreateAtprotoIdentity', () => HttpResponse.json({
        data: { createAtprotoIdentity: null },
        errors: [{ message: 'Your AT Protocol identity could not be created right now. Please try again later.' }]
      }))
    )
    render(<AtprotoIdentitySection />)

    fireEvent.click(await screen.findByTestId('atproto-create-identity'))
    expect(await screen.findByText(/could not be created right now/)).toBeInTheDocument()
    expect(screen.getByTestId('atproto-create-identity')).not.toBeDisabled()
  })

  it.each([
    ['the feature is off', status({ enabled: false, eligible: false, proposedHandle: null })],
    ['the user is not eligible', status({ eligible: false, proposedHandle: null })],
    ['the status is missing', null]
  ])('renders nothing when %s', async (_, atproto) => {
    mockStatus(atproto)
    render(<AtprotoIdentitySection />)

    // Let the status request settle before asserting absence
    await waitFor(() => expect(screen.queryByTestId('atproto-identity-section')).not.toBeInTheDocument())
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.queryByTestId('atproto-identity-section')).not.toBeInTheDocument()
  })
})
