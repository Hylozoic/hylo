import React from 'react'
import orm from 'store/models'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import TopNav from './TopNav'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))
jest.mock('../GlobalNav/GlobalNav', () => ({ SettingsMenu: () => null }))
jest.mock('../GlobalNav/NotificationsDropdown', () => ({ __esModule: true, default: () => null }))
jest.mock('components/CreateMenu', () => () => null)

function stateWithSpaceMemberships () {
  const session = orm.mutableSession(orm.getEmptyState())
  const me = session.Me.create({ id: 'user-1' })
  session.Person.create({ id: me.id, name: 'Test User' })
  const parent = session.Group.create({ id: 'parent-id', name: 'Parent', slug: 'parent' })
  const pinnedSpace = session.Group.create({
    id: 'space-id',
    name: 'Pinned Space',
    slug: 'parent-space',
    type: 'space',
    parentId: parent.id
  })
  const unpinnedSpace = session.Group.create({
    id: 'unpinned-space-id',
    name: 'Unpinned Space',
    slug: 'parent-unpinned',
    type: 'space',
    parentId: parent.id
  })
  session.Membership.create({ id: 'm-parent', group: parent.id, person: me.id, navOrder: 0 })
  session.Membership.create({ id: 'm-space', group: pinnedSpace.id, person: me.id, navOrder: 1 })
  session.Membership.create({ id: 'm-unpinned-space', group: unpinnedSpace.id, person: me.id, navOrder: null })
  return { orm: session.state }
}

describe('TopNav pinned spaces', () => {
  it('includes pinned spaces only and navigates via the parent-scoped space URL', async () => {
    const state = stateWithSpaceMemberships()
    mockNavigate.mockClear()
    render(
      <TopNav currentUser={{ settings: {} }} />,
      { wrapper: AllTheProviders(state, ['/groups/parent']) }
    )

    await waitFor(() => expect(screen.getByTestId('top-nav-overflow-trigger')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('top-nav-overflow-trigger'))

    const pinnedSpace = await screen.findByText('Pinned Space')
    expect(pinnedSpace).toBeVisible()
    expect(screen.queryByText('Unpinned Space')).not.toBeInTheDocument()

    fireEvent.click(pinnedSpace)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/groups/parent/spaces/space')
    })
  })
})
