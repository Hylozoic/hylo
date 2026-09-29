import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { fireEvent, render, screen, waitFor, within } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import OrphanedGroups from './OrphanedGroups'

const orphaned = {
  id: '7',
  name: 'Seed Library',
  slug: 'seed-library',
  avatarUrl: null,
  createdAt: '2025-01-02T00:00:00.000Z',
  memberCount: 12,
  lastActivityAt: null,
  candidates: [{ id: '31', name: 'Mona Moderator', avatarUrl: null, roleName: 'Moderator' }]
}

describe('OrphanedGroups', () => {
  it('lists groups without an Administrator with their Moderators and Hosts, and assigns one', async () => {
    let assigned = null
    mockGraphqlServer.use(
      graphql.query('OrphanedGroups', () => HttpResponse.json({
        data: { orphanedGroups: { total: 1, hasMore: false, items: [orphaned] } }
      })),
      graphql.mutation('AssignOrphanedGroupAdministrator', ({ variables }) => {
        assigned = variables
        return HttpResponse.json({ data: { assignOrphanedGroupAdministrator: { success: true, error: null } } })
      })
    )
    const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true)

    render(<OrphanedGroups />)

    const card = await screen.findByTestId('orphaned-group')
    expect(within(card).getByText('Seed Library')).toBeInTheDocument()
    expect(within(card).getByText('Members: 12', { exact: false })).toBeInTheDocument()
    expect(within(card).getByText('No posts yet', { exact: false })).toBeInTheDocument()
    expect(within(card).getByText('Mona Moderator')).toBeInTheDocument()

    fireEvent.click(within(card).getByRole('button', { name: 'Make Administrator' }))

    expect(confirm).toHaveBeenCalledWith('Make Mona Moderator the Administrator of Seed Library?')
    expect(await screen.findByText('Mona Moderator is now the Administrator of Seed Library.')).toBeInTheDocument()
    expect(assigned).toEqual({ groupId: '7', personId: '31' })
    await waitFor(() => expect(screen.queryByTestId('orphaned-group')).not.toBeInTheDocument())
    confirm.mockRestore()
  })

  it('says when no group is missing an Administrator', async () => {
    mockGraphqlServer.use(
      graphql.query('OrphanedGroups', () => HttpResponse.json({
        data: { orphanedGroups: { total: 0, hasMore: false, items: [] } }
      }))
    )

    render(<OrphanedGroups />)

    expect(await screen.findByText('No groups are missing an Administrator.')).toBeInTheDocument()
  })
})
