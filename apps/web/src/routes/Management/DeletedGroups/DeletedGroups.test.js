import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import DeletedGroups from './DeletedGroups'

describe('DeletedGroups', () => {
  it('lists restorable deleted groups and restores one', async () => {
    let restored = null
    mockGraphqlServer.use(
      graphql.query('DeletedGroups', () => HttpResponse.json({
        data: {
          deletedGroups: [{
            id: '3',
            groupId: '7',
            name: 'Seed Library',
            slug: 'seed-library',
            avatarUrl: null,
            deletedAt: '2026-09-20T00:00:00.000Z',
            restorableUntil: '2026-10-20T00:00:00.000Z',
            deletedByName: 'Sam Steward',
            memberCount: 12
          }]
        }
      })),
      graphql.mutation('RestoreDeletedGroup', ({ variables }) => {
        restored = variables
        return HttpResponse.json({ data: { restoreDeletedGroup: { success: true, error: null } } })
      })
    )
    const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true)

    render(<DeletedGroups />)

    const row = await screen.findByTestId('deleted-group')
    expect(row).toHaveTextContent('Seed Library')
    expect(row).toHaveTextContent('Sam Steward')
    expect(row).toHaveTextContent('Members: 12')

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(confirm).toHaveBeenCalledWith('Restore Seed Library and bring back its 12 members?')
    expect(await screen.findByText('Seed Library has been restored.')).toBeInTheDocument()
    expect(restored).toEqual({ id: '3' })
    await waitFor(() => expect(screen.queryByTestId('deleted-group')).not.toBeInTheDocument())
    confirm.mockRestore()
  })
})
