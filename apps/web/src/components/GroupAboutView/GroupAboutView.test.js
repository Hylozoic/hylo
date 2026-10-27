import React from 'react'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import GroupAboutView from './GroupAboutView'

jest.mock('routes/Members', () => () => null)
jest.mock('routes/Groups', () => () => null)
jest.mock('routes/Moderation', () => () => null)
jest.mock('routes/AuthLayoutRouter/components/ContextMenu/MenuRowBackground', () => () => null)
jest.mock('routes/AuthLayoutRouter/components/ContextMenu/SpaceSettingsModal', () => () => null)

function stateWithMemberships ({ spaceNavOrder = null, withSpaceMembership = true } = {}) {
  const session = orm.mutableSession(orm.getEmptyState())
  const me = session.Me.create({ id: 'user-1' })
  session.Person.create({ id: me.id, name: 'Test User' })
  const parent = session.Group.create({ id: 'parent-id', name: 'Parent', slug: 'parent' })
  const space = session.Group.create({
    id: 'space-id',
    name: 'Space',
    slug: 'parent-space',
    type: 'space',
    parentId: parent.id,
    memberCount: 3
  })
  session.Membership.create({ id: 'parent-membership-id', group: parent.id, person: me.id, navOrder: null })
  if (withSpaceMembership) {
    session.Membership.create({ id: 'membership-id', group: space.id, person: me.id, navOrder: spaceNavOrder })
  }
  return { orm: session.state, parent: session.Group.withId(parent.id), space: session.Group.withId(space.id) }
}

function mockNavOrderMutation () {
  mockGraphqlServer.use(
    graphql.mutation('UpdateMembershipNavOrder', ({ variables }) => HttpResponse.json({
      data: {
        updateMembership: {
          id: 'membership-id',
          navOrder: variables.navOrder,
          group: { id: 'space-id' }
        }
      }
    })),
    graphql.query('FetchGroupRelationships', () => HttpResponse.json({ data: { group: null } }))
  )
}

describe('GroupAboutView global nav pin', () => {
  it('lets a space member pin and unpin the space from the bottom of the About page', async () => {
    mockNavOrderMutation()
    const state = stateWithMemberships()
    render(
      <GroupAboutView group={state.space} parentGroup={state.parent} isSpace />,
      { wrapper: AllTheProviders({ orm: state.orm }, ['/groups/parent/spaces/space/about']) }
    )

    const pinButton = screen.getByRole('button', { name: 'Pin space to global navigation' })
    expect(pinButton).toHaveAttribute('aria-pressed', 'false')
    // Shares the bottom row with Leave Space, below the About cards
    expect(pinButton.parentElement).toContainElement(screen.getByRole('button', { name: 'Leave Space' }))

    fireEvent.click(pinButton)
    const unpinButton = await screen.findByRole('button', { name: 'Unpin space from global navigation' })
    await waitFor(() => expect(unpinButton).toHaveAttribute('aria-pressed', 'true'))

    fireEvent.click(unpinButton)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pin space to global navigation' })).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('shows unpin for a space that is already pinned', () => {
    const state = stateWithMemberships({ spaceNavOrder: 0 })
    render(
      <GroupAboutView group={state.space} parentGroup={state.parent} isSpace />,
      { wrapper: AllTheProviders({ orm: state.orm }, ['/groups/parent/spaces/space/about']) }
    )

    expect(screen.getByRole('button', { name: 'Unpin space from global navigation' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not show the pin control without a space membership', () => {
    const state = stateWithMemberships({ withSpaceMembership: false })
    render(
      <GroupAboutView group={state.space} parentGroup={state.parent} isSpace />,
      { wrapper: AllTheProviders({ orm: state.orm }, ['/groups/parent/spaces/space/about']) }
    )

    expect(screen.queryByTestId('space-global-nav-pin')).not.toBeInTheDocument()
  })

  it('does not show the space pin control on a group About page', () => {
    mockNavOrderMutation()
    const state = stateWithMemberships()
    render(
      <GroupAboutView group={state.parent} />,
      { wrapper: AllTheProviders({ orm: state.orm }, ['/groups/parent/about']) }
    )

    expect(screen.getByRole('button', { name: 'Leave Parent' })).toBeInTheDocument()
    expect(screen.queryByTestId('space-global-nav-pin')).not.toBeInTheDocument()
  })
})
