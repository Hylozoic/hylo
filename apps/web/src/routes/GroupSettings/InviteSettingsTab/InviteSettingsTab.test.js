import React from 'react'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_TYPES, GROUP_VISIBILITY } from 'store/models/Group'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import InviteSettingsTab from './InviteSettingsTab'

describe('InviteSettingsTab', () => {
  it('renders correctly', () => {
    const group = {
      id: 1,
      name: 'Hylo',
      invitePath: '/groups/hylo/join/lalala'
    }

    render(
      <InviteSettingsTab
        group={group}
      />
    )

    expect(screen.getByText('Invite people on Hylo')).toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate a Link|Reset Link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send Invite/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/example@domain.com/i)).toBeInTheDocument()
    expect(screen.getByText(/An invitation link will be sent to each email address. They will still be shown any required questions or agreements you may have set to join this group./)).toBeInTheDocument()
    expect(screen.queryByText(/Customize the invite email message/i)).not.toBeInTheDocument()
  })

  it('shows a public link for public groups', () => {
    const group = {
      id: 1,
      name: 'Hylo',
      slug: 'hylo',
      visibility: GROUP_VISIBILITY.Public,
      accessibility: GROUP_ACCESSIBILITY.Open
    }

    render(<InviteSettingsTab group={group} />)

    expect(screen.getByText('Public Group Link')).toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
  })

  it('hides the public link for spaces and only shows the join link', () => {
    const group = {
      id: 2,
      name: 'Space',
      slug: 'space',
      type: GROUP_TYPES.space,
      parentId: 1,
      visibility: GROUP_VISIBILITY.Public,
      accessibility: GROUP_ACCESSIBILITY.Open
    }

    render(<InviteSettingsTab group={group} parentGroup={{ id: 1, name: 'Hylo' }} inModal />)

    expect(screen.queryByText('Public Group Link')).not.toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
    expect(screen.getByText(/An invitation link will be sent to each email address to join this space. If they are not yet a member of Hylo they will be asked to join that first./)).toBeInTheDocument()
    expect(screen.getByText('Use this link to invite people to the space.')).toBeInTheDocument()
    expect(screen.getByText(/If they are not a member of Hylo they will be given the opportunity to join that first, so make sure you know and trust them./)).toBeInTheDocument()
  })
})

describe('InviteSettingsTab with limited invite access', () => {
  const baseGroup = {
    id: '1',
    name: 'Go Team',
    slug: 'goteam',
    visibility: GROUP_VISIBILITY.Protected,
    accessibility: GROUP_ACCESSIBILITY.Restricted,
    myInviteAccess: 'limited',
    myInviteAllowance: 7,
    groupRoles: { items: [{ id: '5', name: 'Host', active: true }] }
  }

  function providers (group) {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create(group)
    ormSession.Invitation.create({ id: '31', email: 'first@example.com', group: group.id, createdAt: '2026-09-20T10:00:00.000Z', lastSentAt: '2026-09-20T10:00:00.000Z' })
    ormSession.Invitation.create({ id: '32', email: 'second@example.com', group: group.id, createdAt: '2026-09-21T10:00:00.000Z', lastSentAt: '2026-09-21T10:00:00.000Z' })
    ormSession.Me.create({ id: '10', name: 'Tester', groupRoles: { items: [] } })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  function renderLimited (overrides = {}) {
    const group = { ...baseGroup, ...overrides }
    return render(<InviteSettingsTab group={group} inviteAccess='limited' inModal />, null, providers(group))
  }

  function mockCreateInvitation (resolver) {
    const requests = []
    mockGraphqlServer.use(
      graphql.operation(({ query, variables }) => {
        if (!query.includes('createInvitation')) return HttpResponse.json({ data: {} })
        requests.push(variables)
        return resolver(variables)
      })
    )
    return requests
  }

  function enterEmails (value) {
    fireEvent.change(screen.getByPlaceholderText(/example@domain.com/i), { target: { value } })
  }

  it('shows only personal email invites, the allowance and the invites this person sent', () => {
    renderLimited()

    expect(screen.queryByText('Share a Join Link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generate a Link|Reset Link/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Invite people on Hylo')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search people...')).not.toBeInTheDocument()
    expect(screen.queryByText('Assign a role to invitees (optional):')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('Pending Invites')).not.toBeInTheDocument()
    expect(screen.queryByText('Resend All')).not.toBeInTheDocument()
    expect(screen.queryByText('Resend')).not.toBeInTheDocument()
    expect(screen.queryByText('Expire')).not.toBeInTheDocument()

    expect(screen.getByText('Send Invites via email')).toBeInTheDocument()
    expect(screen.getByText('Each person you invite gets an email invitation to join Go Team.')).toBeInTheDocument()
    expect(screen.getByText('Enter up to 10 email addresses at a time, separated by commas or new lines')).toBeInTheDocument()
    expect(screen.getByText('Group stewards can see the email addresses you invite.')).toBeInTheDocument()
    expect(screen.getByText('Invites left today: 7')).toBeInTheDocument()
    expect(screen.getByText('Your pending invites')).toBeInTheDocument()
    expect(screen.getByText('first@example.com')).toBeInTheDocument()
    expect(screen.getByText('second@example.com')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(2)
  })

  it('explains the approval step in Restricted and Closed groups only', () => {
    const note = 'New members of this group need approval, so the people you invite will ask to join and a steward will review their request.'

    const restricted = renderLimited({ accessibility: GROUP_ACCESSIBILITY.Restricted })
    expect(screen.getByText(note)).toBeInTheDocument()
    restricted.unmount()

    const closed = renderLimited({ accessibility: GROUP_ACCESSIBILITY.Closed })
    expect(screen.getByText(note)).toBeInTheDocument()
    closed.unmount()

    renderLimited({ accessibility: GROUP_ACCESSIBILITY.Open })
    expect(screen.queryByText(note)).not.toBeInTheDocument()
  })

  it('keeps the public group link in public groups that are not closed', () => {
    renderLimited({ visibility: GROUP_VISIBILITY.Public, accessibility: GROUP_ACCESSIBILITY.Open })

    expect(screen.getByText('Public Group Link')).toBeInTheDocument()
    expect(screen.queryByText('Share a Join Link')).not.toBeInTheDocument()
  })

  it('cancels one of the invites this person sent', async () => {
    renderLimited()

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0])

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1))
  })

  it('sends email addresses only and shows the same success message for every sent address', async () => {
    const requests = mockCreateInvitation(() => HttpResponse.json({
      data: {
        createInvitation: {
          invitations: [
            { id: null, email: 'new@example.com', createdAt: null, lastSentAt: null, error: null, status: 'sent' },
            { id: null, email: 'member@example.com', createdAt: null, lastSentAt: null, error: null, status: 'sent' },
            { id: null, email: 'not-an-email', createdAt: null, lastSentAt: null, error: 'invalid', status: null }
          ]
        }
      }
    }))
    renderLimited()

    enterEmails('new@example.com, member@example.com, not-an-email')
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(await screen.findByText('Invites sent to anyone not already in the group')).toBeInTheDocument()
    expect(screen.getByText(/1 invalid email address\/es found/)).toBeInTheDocument()
    expect(requests).toHaveLength(1)
    expect(requests[0].data).toEqual({
      emails: ['new@example.com', 'member@example.com', 'not-an-email'],
      userIds: [],
      groupRoleId: null
    })
  })

  it('shows the over-limit message when the allowance would be exceeded', async () => {
    mockCreateInvitation(() => HttpResponse.json({ errors: [{ message: 'invite-limit' }], data: { createInvitation: null } }))
    renderLimited()

    enterEmails('one@example.com, two@example.com')
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(await screen.findByText("You don't have enough invites left today for all of these addresses.")).toBeInTheDocument()
    expect(screen.queryByText('Invites sent to anyone not already in the group')).not.toBeInTheDocument()
  })

  it('does not send more than 10 different addresses at a time', () => {
    const requests = mockCreateInvitation(() => HttpResponse.json({ data: { createInvitation: { invitations: [] } } }))
    renderLimited()

    enterEmails(Array.from({ length: 11 }, (_, i) => `person${i}@example.com`).join('\n'))
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(screen.getByText('You can invite up to 10 email addresses at a time')).toBeInTheDocument()
    expect(requests).toHaveLength(0)
  })

  it('disables sending when no invites are left today', () => {
    renderLimited({ myInviteAllowance: 0 })

    enterEmails('one@example.com')

    expect(screen.getByText('Invites left today: 0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send Invite/i })).toHaveClass('disabled')
  })
})

describe('InviteSettingsTab with full invite access', () => {
  it('lists every pending invite with Expire, Resend and Resend All', () => {
    const group = { id: '1', name: 'Go Team', slug: 'goteam', myInviteAccess: 'full' }
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create(group)
    ormSession.Invitation.create({ id: '31', email: 'first@example.com', name: 'First Person', group: '1', createdAt: '2026-09-20T10:00:00.000Z', lastSentAt: '2026-09-20T10:00:00.000Z' })

    render(<InviteSettingsTab group={group} />, null, AllTheProviders({ orm: ormSession.state, pending: {} }))

    expect(screen.getByText('Pending Invites')).toBeInTheDocument()
    expect(screen.getByText('Resend All')).toBeInTheDocument()
    expect(screen.getByText('Expire')).toBeInTheDocument()
    expect(screen.getByText('Resend')).toBeInTheDocument()
    expect(screen.getByText('First Person')).toBeInTheDocument()
    expect(screen.queryByText('Your pending invites')).not.toBeInTheDocument()
    expect(screen.queryByText(/Invites left today/)).not.toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
    expect(screen.getByText('Assign a role to invitees (optional):')).toBeInTheDocument()
  })
})
