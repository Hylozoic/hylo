import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { fireEvent, render, screen, waitFor, within } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import SoleAdminLeaveDialog from './SoleAdminLeaveDialog'

const group = { id: '5', name: 'Seed Library', slug: 'seed-library' }

function renderDialog (props = {}) {
  const onConfirm = jest.fn()
  render(
    <SoleAdminLeaveDialog
      open
      onOpenChange={jest.fn()}
      group={group}
      title='Leave Group'
      description='Are you sure you want to leave Seed Library?'
      confirmLabel='Leave Group'
      onConfirm={onConfirm}
      {...props}
    />
  )
  return onConfirm
}

describe('SoleAdminLeaveDialog', () => {
  it("says you're the only Administrator, offers a hand-off, and still lets you leave", async () => {
    let handedOff = null
    mockGraphqlServer.use(
      graphql.query('MySoleAdministratorGroups', () => HttpResponse.json({ data: { mySoleAdministratorGroups: [group] } })),
      graphql.operation(({ query, variables }) => {
        if (query.includes('handOffAdministrator')) {
          handedOff = variables
          return HttpResponse.json({ data: { handOffAdministrator: { success: true, error: null } } })
        }
        if (query.includes('members (first: 10')) {
          return HttpResponse.json({ data: { group: { id: '5', members: { hasMore: false, items: [{ id: '8', name: 'Mona Moderator', avatarUrl: null }] } } } })
        }
        return HttpResponse.json({ data: {} })
      })
    )
    const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true)
    const onConfirm = renderDialog()

    const notice = await screen.findByTestId('sole-administrator-leave')
    expect(within(notice).getByText("You're the only Administrator")).toBeInTheDocument()

    fireEvent.change(within(notice).getByRole('textbox', { name: "Search this group's members" }), { target: { value: 'mo' } })
    fireEvent.click(await within(notice).findByRole('button', { name: 'Make Administrator' }))

    expect(confirm).toHaveBeenCalledWith('Make Mona Moderator an Administrator of Seed Library?')
    expect(await screen.findByText('Mona Moderator is now an Administrator of Seed Library.')).toBeInTheDocument()
    expect(handedOff).toEqual({ groupId: '5', personId: '8' })
    expect(screen.queryByTestId('sole-administrator-leave')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Leave Group' }))
    expect(onConfirm).toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('is a plain confirmation when others administer the group too', async () => {
    let asked = false
    mockGraphqlServer.use(
      graphql.query('MySoleAdministratorGroups', () => {
        asked = true
        return HttpResponse.json({ data: { mySoleAdministratorGroups: [] } })
      })
    )
    const onConfirm = renderDialog()

    await waitFor(() => expect(asked).toBe(true))
    expect(screen.queryByTestId('sole-administrator-leave')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Leave Group' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('does not check spaces, whose roles belong to the parent group', async () => {
    let asked = false
    mockGraphqlServer.use(
      graphql.query('MySoleAdministratorGroups', () => {
        asked = true
        return HttpResponse.json({ data: { mySoleAdministratorGroups: [group] } })
      })
    )
    renderDialog({ isSpace: true, title: 'Leave Space', confirmLabel: 'Leave Space' })

    expect(screen.getByRole('button', { name: 'Leave Space' })).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(asked).toBe(false)
    expect(screen.queryByTestId('sole-administrator-leave')).not.toBeInTheDocument()
  })
})
