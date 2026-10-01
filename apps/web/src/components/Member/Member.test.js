import React from 'react'
import { fireEvent } from '@testing-library/react'
import { graphql, HttpResponse } from 'msw'
import { toast } from 'sonner'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import Member from './Member'

jest.mock('sonner', () => {
  const toast = jest.fn()
  toast.error = jest.fn()
  toast.success = jest.fn()
  return { toast }
})

const minProps = {
  group: { id: '1', slug: 'test-group' },
  member: {
    id: '1',
    name: 'Test Member',
    location: 'Test Location',
    tagline: 'Test Tagline',
    avatarUrl: 'test-avatar.jpg'
  },
  removeMember: jest.fn()
}

describe('Member Component', () => {
  it('renders member information', () => {
    render(<Member {...minProps} />)

    expect(screen.getByText('Test Member')).toBeInTheDocument()
    expect(screen.getByText('Test Location')).toBeInTheDocument()
    expect(screen.getByText('Test Tagline')).toBeInTheDocument()
    expect(screen.getByTestId('member-card')).toBeInTheDocument()
  })

  it('renders square layout when square prop is set', () => {
    render(<Member {...minProps} square />)

    expect(screen.getByTestId('member-card')).toBeInTheDocument()
    expect(screen.getByText('Test Member')).toBeInTheDocument()
  })

  it('renders the join date, with no dot for a long-inactive member', () => {
    const { container } = render(
      <Member
        {...minProps}
        member={{
          ...minProps.member,
          enrolledAt: '2024-01-15T00:00:00.000Z',
          lastActiveAt: '2025-06-01T00:00:00.000Z'
        }}
      />
    )

    expect(screen.getByText(/Joined/)).toBeInTheDocument()
    expect(container.querySelector('.bg-green-500')).not.toBeInTheDocument()
  })

  it('wears a green dot on the avatar for recently active members', () => {
    const { container } = render(
      <Member
        {...minProps}
        member={{
          ...minProps.member,
          lastActiveAt: String(Date.now())
        }}
      />
    )

    expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
  })
})

describe('Member removal: also block from rejoining (D60)', () => {
  const steward = (titles) => ({
    id: '6',
    groupId: '1',
    name: 'Steward',
    responsibilities: { items: titles.map((title, i) => ({ id: String(i + 1), title })) }
  })

  function providers ({ titles = ['Remove Members', 'Add Members'], groupType } = {}) {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create({ id: '1', slug: 'test-group', name: 'Test Group', type: groupType })
    ormSession.Me.create({ id: '10', name: 'You', groupRoles: { items: [steward(titles)] } })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  let operations

  beforeEach(() => {
    operations = []
    toast.mockClear()
    toast.error.mockClear()
    toast.success.mockClear()
    mockGraphqlServer.use(
      graphql.operation(({ query, variables }) => {
        const name = ['banFromGroup', 'regenerateAccessCode'].find(op => query.includes(op + '('))
        if (!name) return
        operations.push({ name, variables })
        return HttpResponse.json({
          data: name === 'banFromGroup'
            ? { banFromGroup: { success: true } }
            : { regenerateAccessCode: { id: '1', invitePath: '/groups/test-group/join/new' } }
        })
      })
    )
  })

  const openRemoveDialog = async () => {
    fireEvent.click(screen.getByTestId('dropdown-toggle'))
    fireEvent.click(await screen.findByText('Remove member from group'))
    return screen.findByTestId('block-from-rejoining')
  }

  it('leaves the box unticked, and removes without blocking unless it is ticked', async () => {
    const removeMember = jest.fn(() => Promise.resolve({}))
    render(<Member {...minProps} group={{ id: '1', slug: 'test-group' }} removeMember={removeMember} />, null, providers())

    const checkbox = await openRemoveDialog()
    expect(checkbox).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(removeMember).toHaveBeenCalledWith('1'))
    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(operations.filter(op => op.name === 'banFromGroup')).toEqual([])
  })

  it('blocks the person once they are removed when the box is ticked', async () => {
    const removeMember = jest.fn(() => Promise.resolve({}))
    render(<Member {...minProps} group={{ id: '1', slug: 'test-group' }} removeMember={removeMember} />, null, providers())

    fireEvent.click(await openRemoveDialog())
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(operations).toContainEqual({ name: 'banFromGroup', variables: { personId: '1', groupId: '1' } }))
    expect(removeMember).toHaveBeenCalledWith('1')
  })

  it('does not block anyone when the server refuses the removal', async () => {
    const removeMember = jest.fn(() => Promise.resolve({ error: true }))
    render(<Member {...minProps} group={{ id: '1', slug: 'test-group' }} removeMember={removeMember} />, null, providers())

    fireEvent.click(await openRemoveDialog())
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(removeMember).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(operations).toEqual([])
    expect(toast).not.toHaveBeenCalled()
  })

  it('offers to reset the join link after removing someone, to people who can add members', async () => {
    const removeMember = jest.fn(() => Promise.resolve({}))
    render(<Member {...minProps} group={{ id: '1', slug: 'test-group' }} removeMember={removeMember} />, null, providers())

    await openRemoveDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Test Member was removed', expect.objectContaining({
      action: expect.objectContaining({ label: 'Reset join link' })
    })))
    await toast.mock.calls[0][1].action.onClick()
    expect(operations).toContainEqual({ name: 'regenerateAccessCode', variables: { groupId: '1' } })
    expect(toast.success).toHaveBeenCalledWith('The join link was reset')
  })

  it('does not offer the join link reset to someone who can remove but not add members', async () => {
    const removeMember = jest.fn(() => Promise.resolve({}))
    render(<Member {...minProps} group={{ id: '1', slug: 'test-group' }} removeMember={removeMember} />, null, providers({ titles: ['Remove Members'] }))

    await openRemoveDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(removeMember).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(toast).not.toHaveBeenCalled()
  })

  it('offers no block when removing someone from a space', async () => {
    const removeMember = jest.fn(() => Promise.resolve({}))
    render(<Member {...minProps} group={{ id: '1', slug: 'test-group', type: 'space' }} removeMember={removeMember} />, null, providers())

    fireEvent.click(screen.getByTestId('dropdown-toggle'))
    fireEvent.click(await screen.findByText('Remove member from group'))
    expect(await screen.findByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(screen.queryByTestId('block-from-rejoining')).not.toBeInTheDocument()
  })
})
