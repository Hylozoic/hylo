import React from 'react'
import userEvent from '@testing-library/user-event'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { TOUR_LAYOUT_TABS } from 'tours/layouts'
import { BUILDING_HYLO_ABOUT_PATH } from 'util/support'
import TopNav from './TopNav'

jest.mock('react-use-intercom', () => ({
  useIntercom: () => ({ show: () => {} })
}))

const currentUser = {
  id: '1',
  name: 'Test User',
  hasRegistered: true,
  emailValidated: true,
  settings: { signupInProgress: false, globalNavStyle: 'tabs' }
}

function providersWithMe () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create(currentUser)
  return AllTheProviders({ orm: ormSession.state })
}

beforeEach(() => {
  mockGraphqlServer.use(
    graphql.query('NotificationsQuery', () => HttpResponse.json({ data: { notifications: null } }))
  )
})

describe('TopNav', () => {
  it('marks itself as the top-bar tour layout and carries the global tour anchors', async () => {
    const { container } = render(<TopNav currentUser={currentUser} />, { wrapper: providersWithMe() })

    await waitFor(() => {
      expect(container.querySelector('[data-tour="activity"]')).toBeInTheDocument()
    })
    expect(container.querySelector('.TopNav')).toHaveAttribute('data-tour-layout', TOUR_LAYOUT_TABS)
    ;['my-home', 'messages', 'the-commons', 'create', 'help'].forEach(name => {
      expect(container.querySelector(`[data-tour="${name}"]`)).toBeInTheDocument()
    })
  })

  it('offers the shared help menu, with Join Building Hylo and the tours', async () => {
    const user = userEvent.setup()
    render(<TopNav currentUser={currentUser} />, { wrapper: providersWithMe() })
    const help = await screen.findByRole('button', { name: 'Help' })
    expect(help).toHaveAttribute('data-tour', 'help')

    await user.click(help)
    expect(await screen.findByRole('menuitem', { name: 'Join Building Hylo' })).toHaveAttribute('href', BUILDING_HYLO_ABOUT_PATH)
    expect(screen.getByRole('menuitem', { name: /Take a tour/ })).toBeInTheDocument()
  })
})
