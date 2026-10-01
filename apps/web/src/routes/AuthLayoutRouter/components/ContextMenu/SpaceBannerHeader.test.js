import React from 'react'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { SpaceBannerHeader } from './ContextMenuGrid'

jest.mock('components/GroupNotificationsPopover/GroupNotificationsPopover', () => () => null)
jest.mock('components/InviteMembersDialog/InviteMembersDialog', () => () => null)
jest.mock('./GroupViewIcon', () => () => null)
jest.mock('./MenuRowBackground', () => () => null)

function stateWithSpaceMembership (navOrder = null) {
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
  session.Membership.create({
    id: 'membership-id',
    group: space.id,
    person: me.id,
    navOrder
  })
  return { orm: session.state, parent, space }
}

function renderHeader (state) {
  return render(
    <SpaceBannerHeader
      group={state.parent}
      spaceGroup={state.space}
      canAdminister={false}
      onOpenSettings={() => {}}
      t={key => key}
    />,
    { wrapper: AllTheProviders({ orm: state.orm }, ['/groups/parent/spaces/space']) }
  )
}

describe('SpaceBannerHeader navigation pin', () => {
  it('lets a member pin and unpin the space from global navigation', async () => {
    mockGraphqlServer.use(
      graphql.mutation('UpdateMembershipNavOrder', ({ variables }) => HttpResponse.json({
        data: {
          updateMembership: {
            id: 'membership-id',
            navOrder: variables.navOrder,
            group: { id: 'space-id' }
          }
        }
      }))
    )
    renderHeader(stateWithSpaceMembership())

    const pinButton = screen.getByRole('button', { name: 'Pin space to global navigation' })
    expect(pinButton).toHaveAttribute('aria-pressed', 'false')
    expect(pinButton).toBeVisible()

    fireEvent.click(pinButton)
    const unpinButton = await screen.findByRole('button', { name: 'Unpin space from global navigation' })
    await waitFor(() => expect(unpinButton).toHaveAttribute('aria-pressed', 'true'))

    fireEvent.click(unpinButton)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pin space to global navigation' })).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('does not show the pin control without a space membership', () => {
    const state = stateWithSpaceMembership()
    const session = orm.mutableSession(state.orm)
    session.Membership.all().toModelArray().forEach(membership => membership.delete())

    renderHeader({ ...state, orm: session.state })

    expect(screen.queryByTestId('space-global-nav-pin')).not.toBeInTheDocument()
  })
})
