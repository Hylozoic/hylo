import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import ResponsibilitiesTab from './ResponsibilitiesTab'

describe('ResponsibilitiesTab', () => {
  let savedFlag

  beforeEach(() => {
    savedFlag = process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    mockGraphqlServer.use(
      graphql.query('fetchResponsibiltiesForGroup', () => HttpResponse.json({
        data: {
          responsibilities: [
            { id: '1', title: 'Administration', type: 'system', description: 'Manage the group' },
            { id: '41', title: 'Invite Members', type: 'system', description: 'Send personal email invitations' },
            { id: '70', title: 'Greet Newcomers', type: 'group', description: 'Say hello' }
          ]
        }
      }))
    )
  })

  afterEach(() => {
    if (savedFlag === undefined) {
      delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    } else {
      process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = savedFlag
    }
  })

  it('lists the built-in and custom responsibilities', async () => {
    render(<ResponsibilitiesTab group={{ id: '1' }} />, { wrapper: AllTheProviders() })

    expect(await screen.findByText('Administration')).toBeInTheDocument()
    expect(screen.getByText('Invite Members')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Greet Newcomers')).toBeInTheDocument()
  })

  it('leaves out Invite Members while member invitations are switched off', async () => {
    process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'off'
    render(<ResponsibilitiesTab group={{ id: '1' }} />, { wrapper: AllTheProviders() })

    expect(await screen.findByText('Administration')).toBeInTheDocument()
    expect(screen.queryByText('Invite Members')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Greet Newcomers')).toBeInTheDocument()
  })
})
