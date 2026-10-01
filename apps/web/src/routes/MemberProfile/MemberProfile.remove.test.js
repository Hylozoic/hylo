import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { toast } from 'sonner'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { RESP_ADD_MEMBERS, RESP_REMOVE_MEMBERS } from 'store/constants'
import denormalized from './MemberProfile.test.json'
import MemberProfile from './MemberProfile.js'
import orm from 'store/models'

jest.mock('sonner', () => {
  const toast = jest.fn()
  toast.error = jest.fn()
  toast.success = jest.fn()
  return { toast }
})

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ personId: '46816' }),
  useLocation: jest.fn().mockReturnValue({ pathname: '/groups/test-group/members/46816', search: '' })
}))

// A steward who can remove and add members, looking at another member's profile in a group
function stewardViewingMember (group = { id: '1', slug: 'test-group', name: 'Test Group' }) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Person.create(denormalized.data.person)
  ormSession.Reaction.create(denormalized.data.person.reactions)
  ormSession.Group.create(group)
  ormSession.Me.create({
    id: '999',
    groupRoles: {
      items: [{
        id: 1,
        groupId: '1',
        name: 'Administrator',
        responsibilities: { items: [{ id: 1, title: RESP_REMOVE_MEMBERS }, { id: 2, title: RESP_ADD_MEMBERS }] }
      }]
    }
  })
  return AllTheProviders({ orm: ormSession.state })
}

describe("MemberProfile: 'Also block from rejoining' when removing someone", () => {
  let operations

  beforeEach(() => {
    operations = []
    toast.mockClear()
    toast.error.mockClear()
    mockGraphqlServer.use(
      graphql.query('PersonDetails', () => HttpResponse.json({ data: { person: denormalized.data.person } })),
      graphql.operation(({ query, variables }) => {
        const name = ['removeMember', 'banFromGroup'].find(op => query.includes(op + '('))
        if (!name) return
        operations.push({ name, variables })
        return HttpResponse.json({
          data: name === 'removeMember'
            ? { removeMember: { id: '1', memberCount: 1 } }
            : { banFromGroup: { success: true } }
        })
      })
    )
  })

  const openRemoveDialog = async () => {
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: denormalized.data.person.name })).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByTestId('dropdown-toggle')[0])
    fireEvent.click(screen.getByText('Remove member from group'))
    await screen.findByText('Remove member')
  }

  it('offers the box unticked, and blocks the person once removed when it is ticked', async () => {
    render(<MemberProfile />, { wrapper: stewardViewingMember() })
    await openRemoveDialog()

    const checkbox = screen.getByTestId('block-from-rejoining')
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(operations.map(op => op.name)).toEqual(['removeMember', 'banFromGroup']), { timeout: 5000 })
    expect(operations[1].variables).toEqual({ personId: '46816', groupId: '1' })
    // Then the offer to reset the join link
    await waitFor(() => expect(toast).toHaveBeenCalled(), { timeout: 5000 })
  })

  it("doesn't offer it in a space", async () => {
    render(<MemberProfile />, { wrapper: stewardViewingMember({ id: '1', slug: 'test-group', name: 'A Space', type: 'space' }) })
    await openRemoveDialog()
    expect(screen.queryByTestId('block-from-rejoining')).not.toBeInTheDocument()
  })
})
