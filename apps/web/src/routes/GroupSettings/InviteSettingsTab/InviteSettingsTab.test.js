import React from 'react'
import { graphql, HttpResponse } from 'msw'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_TYPES, GROUP_VISIBILITY } from 'store/models/Group'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import InviteSettingsTab from './InviteSettingsTab'

jest.mock('store/actions/trackAnalyticsEvent', () => {
  const actual = jest.requireActual('store/actions/trackAnalyticsEvent')
  return { __esModule: true, default: jest.fn(actual.default) }
})

// Copying needs a real clipboard: clicking the wrapped button reports a copy instead
jest.mock('react-copy-to-clipboard', () => {
  const React = jest.requireActual('react')
  return ({ children, onCopy, text }) => React.cloneElement(children, { onClick: () => onCopy(text, true) })
})

beforeEach(() => {
  trackAnalyticsEvent.mockClear()
})

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

  it('reports which link was copied', () => {
    const group = {
      id: '1',
      name: 'Hylo',
      slug: 'hylo',
      visibility: GROUP_VISIBILITY.Public,
      accessibility: GROUP_ACCESSIBILITY.Open,
      invitePath: '/groups/hylo/join/lalala'
    }
    render(<InviteSettingsTab group={group} />)

    const copyButtons = screen.getAllByText('Copy')
    fireEvent.click(copyButtons[0])
    fireEvent.click(copyButtons[1])

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Invite Link Copied', { groupId: '1', kind: 'public' })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Invite Link Copied', { groupId: '1', kind: 'join' })
    expect(trackAnalyticsEvent).toHaveBeenCalledTimes(2)
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

  let submissions, operations

  // Answers the member's invitation submissions, their cancellation and any extra operations
  // given by a word in their query; everything else gets empty data
  function mockLimited (extra = {}) {
    operations = {}
    mockGraphqlServer.use(
      graphql.operation(({ query, variables }) => {
        const record = key => { (operations[key] = operations[key] || []).push(variables) }
        const extraKey = Object.keys(extra).find(key => query.includes(key))
        if (extraKey) {
          record(extraKey)
          return extra[extraKey](variables)
        }
        if (query.includes('myInvitationSubmissions')) {
          record('myInvitationSubmissions')
          return HttpResponse.json({ data: { group: { id: '1', myInvitationSubmissions: { total: submissions.length, hasMore: false, items: submissions } } } })
        }
        if (query.includes('cancelInvitationSubmission')) {
          record('cancelInvitationSubmission')
          submissions = submissions.filter(item => item.id !== variables.submissionId)
          return HttpResponse.json({ data: { cancelInvitationSubmission: { success: true } } })
        }
        return HttpResponse.json({ data: {} })
      })
    )
    return operations
  }

  beforeEach(() => {
    submissions = [
      { id: '32', email: 'second@example.com', createdAt: '2026-09-21T10:00:00.000Z', person: null },
      { id: '31', email: 'first@example.com', createdAt: '2026-09-20T10:00:00.000Z', person: null }
    ]
  })

  function providers (group) {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create(group)
    ormSession.Me.create({ id: '10', name: 'Tester', groupRoles: { items: [] } })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  function renderLimited (overrides = {}) {
    const group = { ...baseGroup, ...overrides }
    return render(<InviteSettingsTab group={group} inviteAccess='limited' inModal />, null, providers(group))
  }

  it('shows only personal email invites, the allowance and what this person submitted', async () => {
    mockLimited()
    renderLimited()

    expect(await screen.findByText('first@example.com')).toBeInTheDocument()
    expect(screen.queryByText('Share a Join Link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generate a Link/i })).not.toBeInTheDocument()
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
    expect(screen.getByLabelText('Add a personal note (optional)')).toBeInTheDocument()
    expect(screen.getByText('Your pending invites')).toBeInTheDocument()
    expect(screen.getByText('second@example.com')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(2)
  })

  it('shows people picked from the search by name, like every other row', async () => {
    submissions = [{ id: '33', email: null, createdAt: '2026-09-22T10:00:00.000Z', person: { id: '60', name: 'Robin Park', avatarUrl: null } }]
    mockLimited()
    renderLimited()

    expect(await screen.findByText('Robin Park')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1)
  })

  it('shows no list when nothing was submitted lately', async () => {
    submissions = []
    const operations = mockLimited()
    renderLimited()

    await waitFor(() => expect(operations.myInvitationSubmissions).toHaveLength(1))
    expect(screen.queryByText('Your pending invites')).not.toBeInTheDocument()
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

  describe('personal invite link', () => {
    const linkResponse = (field, path) => () => HttpResponse.json({ data: { [field]: { path, createdAt: '2026-09-22T10:00:00.000Z' } } })

    it('makes the link when asked, then copies it and reports a member link copy', async () => {
      const operations = mockLimited({
        myInviteLink: () => HttpResponse.json({ data: { group: { id: '1', myInviteLink: null } } }),
        createMemberInviteLink: linkResponse('createMemberInviteLink', '/groups/goteam/join/MemberCode12345')
      })
      renderLimited()

      expect(await screen.findByText('Your personal invite link')).toBeInTheDocument()
      expect(screen.getByText('People who use your link ask to join, and a steward reviews their request.')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Create my invite link' }))

      expect(await screen.findByText(`${window.location.origin}/groups/goteam/join/MemberCode12345`)).toBeInTheDocument()
      expect(operations.createMemberInviteLink).toEqual([{ groupId: '1' }])
      fireEvent.click(screen.getByText('Copy'))
      expect(trackAnalyticsEvent).toHaveBeenCalledWith('Invite Link Copied', { groupId: '1', kind: 'member' })
    })

    it('shows the link the member already has and replaces it on Reset', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true)
      mockLimited({
        myInviteLink: () => HttpResponse.json({ data: { group: { id: '1', myInviteLink: { path: '/groups/goteam/join/OldCode123456789', createdAt: null } } } }),
        resetMemberInviteLink: linkResponse('resetMemberInviteLink', '/groups/goteam/join/NewCode123456789')
      })
      renderLimited({ accessibility: GROUP_ACCESSIBILITY.Open })

      expect(await screen.findByText(`${window.location.origin}/groups/goteam/join/OldCode123456789`)).toBeInTheDocument()
      expect(screen.getByText('People who use your link join right away.')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Reset Link' }))

      expect(await screen.findByText(`${window.location.origin}/groups/goteam/join/NewCode123456789`)).toBeInTheDocument()
      expect(confirmSpy).toHaveBeenCalledWith("Are you sure you want to reset your invite link? The current link won't work anymore.")
      confirmSpy.mockRestore()
    })

    it('is not shown while member invitations are switched off on the web', async () => {
      const saved = process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
      process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'off'
      try {
        const operations = mockLimited()
        renderLimited()
        await waitFor(() => expect(operations.myInvitationSubmissions).toHaveLength(1))
        expect(screen.queryByText('Your personal invite link')).not.toBeInTheDocument()
        expect(operations.myInviteLink).toBeUndefined()
      } finally {
        if (saved === undefined) delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
        else process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = saved
      }
    })
  })

  it('cancels one of the rows this person submitted', async () => {
    const operations = mockLimited()
    renderLimited()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Cancel' }))[0])

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1))
    expect(operations.cancelInvitationSubmission).toEqual([{ submissionId: '32' }])
    expect(screen.queryByText('second@example.com')).not.toBeInTheDocument()
    expect(screen.getByText('first@example.com')).toBeInTheDocument()
  })

  it('reloads the list after sending, so the new addresses show', async () => {
    const operations = mockLimited({
      createInvitation: () => {
        submissions = [{ id: '40', email: 'new@example.com', createdAt: '2026-09-23T10:00:00.000Z', person: null }, ...submissions]
        return HttpResponse.json({ data: { createInvitation: { invitations: [{ id: null, email: 'new@example.com', createdAt: null, lastSentAt: null, error: null, status: 'sent' }] } } })
      }
    })
    renderLimited()
    await screen.findByText('first@example.com')

    enterEmails('new@example.com')
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    await waitFor(() => expect(operations.myInvitationSubmissions).toHaveLength(2))
    await waitFor(() => expect(screen.getAllByRole('listitem').map(item => item.textContent).join(' ')).toContain('new@example.com'))
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(3)
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
    expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1)
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invitations Sent', {
      numGood: 2,
      numSubmitted: 3,
      inviteAccess: 'limited'
    })
  })

  it('shows the over-limit message when the allowance would be exceeded', async () => {
    mockCreateInvitation(() => HttpResponse.json({ errors: [{ message: 'invite-limit' }], data: { createInvitation: null } }))
    renderLimited()

    enterEmails('one@example.com, two@example.com')
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(await screen.findByText("You don't have enough invites left today for all of these addresses.")).toBeInTheDocument()
    expect(screen.queryByText('Invites sent to anyone not already in the group')).not.toBeInTheDocument()
    expect(trackAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('does not send more than 10 different addresses at a time', () => {
    const requests = mockCreateInvitation(() => HttpResponse.json({ data: { createInvitation: { invitations: [] } } }))
    renderLimited()

    enterEmails(Array.from({ length: 11 }, (_, i) => `person${i}@example.com`).join('\n'))
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(screen.getByText('You can invite up to 10 email addresses at a time')).toBeInTheDocument()
    expect(requests).toHaveLength(0)
  })

  describe('with the member people picker switched on', () => {
    let savedFlag

    beforeEach(() => {
      savedFlag = process.env.VITE_FEATURE_FLAG_MEMBER_INVITE_PICKER
      process.env.VITE_FEATURE_FLAG_MEMBER_INVITE_PICKER = 'on'
    })

    afterEach(() => {
      if (savedFlag === undefined) delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITE_PICKER
      else process.env.VITE_FEATURE_FLAG_MEMBER_INVITE_PICKER = savedFlag
    })

    it('searches only people who share a group with the member, and sends the people picked', async () => {
      let peopleVariables
      const requests = []
      mockGraphqlServer.use(
        graphql.operation(({ query, variables }) => {
          if (query.includes('people (')) {
            peopleVariables = variables
            return HttpResponse.json({ data: { people: { hasMore: false, items: [{ id: '60', name: 'Robin Park', avatarUrl: null }] } } })
          }
          if (query.includes('createInvitation')) {
            requests.push(variables)
            return HttpResponse.json({ data: { createInvitation: { invitations: [{ id: null, email: null, createdAt: null, lastSentAt: null, error: null, status: 'sent' }] } } })
          }
          return HttpResponse.json({ data: {} })
        })
      )
      renderLimited()

      expect(screen.getByText('Invite people you know on Hylo')).toBeInTheDocument()
      fireEvent.focus(screen.getByPlaceholderText('Search people...'))
      fireEvent.click(await screen.findByText('Robin Park'))
      fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

      expect(await screen.findByText('Invites sent to anyone not already in the group')).toBeInTheDocument()
      expect(peopleVariables).toMatchObject({ excludeGroupId: '1', sharedGroupsOnly: true })
      expect(requests[0].data).toEqual({ emails: [], userIds: ['60'], groupRoleId: null })
    })
  })

  it('does not offer the people search to members while the picker is switched off', () => {
    renderLimited()

    expect(screen.queryByText('Invite people you know on Hylo')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search people...')).not.toBeInTheDocument()
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

  describe('with invitations sent by members', () => {
    const group = { id: '1', name: 'Go Team', slug: 'goteam', myInviteAccess: 'full' }

    function renderWithMemberInvite () {
      const ormSession = orm.mutableSession(orm.getEmptyState())
      ormSession.Group.create(group)
      ormSession.Person.create({ id: '7', name: 'Ada Member' })
      ormSession.Person.create({ id: '8', name: 'Sam Steward' })
      ormSession.Invitation.create({ id: '31', email: 'steward-sent@example.com', group: '1', creator: '8', inviterAccess: 'full', createdAt: '2026-09-20T10:00:00.000Z', lastSentAt: '2026-09-20T10:00:00.000Z' })
      ormSession.Invitation.create({ id: '32', email: 'member-sent@example.com', group: '1', creator: '7', inviterAccess: 'limited', createdAt: '2026-09-21T10:00:00.000Z', lastSentAt: '2026-09-21T10:00:00.000Z' })
      render(<InviteSettingsTab group={group} />, null, AllTheProviders({ orm: ormSession.state, pending: {} }))
    }

    let confirmSpy

    beforeEach(() => {
      confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => false)
    })

    afterEach(() => confirmSpy.mockRestore())

    it('says who sent each invitation from a member', () => {
      renderWithMemberInvite()

      expect(screen.getByText(/Invited by Ada Member/)).toBeInTheDocument()
      expect(screen.queryByText(/Invited by Sam Steward/)).not.toBeInTheDocument()
    })

    it('says that Resend All leaves out invitations from members', () => {
      renderWithMemberInvite()
      fireEvent.click(screen.getByText('Resend All'))

      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to resend all Pending Invitations\n\nInvitations sent by members are not included. They get automatic reminders instead.'
      )
    })
  })

  it('asks for people who are not in the group, and keeps someone who shares a name with an invitee', async () => {
    let peopleVariables
    mockGraphqlServer.use(
      graphql.operation(({ query, variables }) => {
        if (!query.includes('people (')) return HttpResponse.json({ data: {} })
        peopleVariables = variables
        return HttpResponse.json({
          data: {
            people: {
              hasMore: false,
              items: [
                { id: '50', name: 'Pat Lee', avatarUrl: null },
                { id: '51', name: 'Pat Lee', avatarUrl: null },
                { id: '52', name: 'Robin Park', avatarUrl: null }
              ]
            }
          }
        })
      })
    )
    const group = { id: '1', name: 'Go Team', slug: 'goteam', myInviteAccess: 'full' }
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create(group)
    ormSession.Me.create({ id: '10', name: 'Tester' })
    ormSession.Invitation.create({ id: '31', email: 'pat@example.com', name: 'Pat Lee', userId: '50', group: '1', createdAt: '2026-09-20T10:00:00.000Z', lastSentAt: '2026-09-20T10:00:00.000Z' })
    render(<InviteSettingsTab group={group} />, null, AllTheProviders({ orm: ormSession.state, pending: {} }))

    fireEvent.focus(screen.getByPlaceholderText('Search people...'))

    expect(await screen.findByText('Robin Park')).toBeInTheDocument()
    expect(peopleVariables.excludeGroupId).toBe('1')
    // One in the pending invites list, and the other Pat Lee in the picker
    expect(screen.getAllByText('Pat Lee')).toHaveLength(2)
  })

  it('sends an optional personal note, at most 300 characters, and clears it once sent', async () => {
    const requests = mockCreateInvitation(() => HttpResponse.json({
      data: { createInvitation: { invitations: [{ id: '41', email: 'one@example.com', createdAt: null, lastSentAt: null, error: null, status: null }] } }
    }))
    const group = { id: '1', name: 'Go Team', slug: 'goteam' }
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create(group)
    render(<InviteSettingsTab group={group} />, null, AllTheProviders({ orm: ormSession.state, pending: {} }))

    const noteField = screen.getByLabelText('Add a personal note (optional)')
    fireEvent.change(noteField, { target: { value: 'y'.repeat(320) } })
    expect(noteField.value).toHaveLength(300)
    expect(screen.getByText('Plain text, shown in the invitation email. 0 characters left.')).toBeInTheDocument()
    fireEvent.change(noteField, { target: { value: ' Come garden with us ' } })
    enterEmails('one@example.com')
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(await screen.findByText('Sent 1 invite')).toBeInTheDocument()
    expect(requests[0].data).toEqual({ emails: ['one@example.com'], userIds: [], groupRoleId: null, note: 'Come garden with us' })
    expect(noteField.value).toBe('')
  })

  it('asks only the usual question before Resend All when no member sent an invitation', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => false)
    const group = { id: '1', name: 'Go Team', slug: 'goteam', myInviteAccess: 'full' }
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create(group)
    ormSession.Invitation.create({ id: '31', email: 'first@example.com', group: '1', inviterAccess: 'full', createdAt: '2026-09-20T10:00:00.000Z', lastSentAt: '2026-09-20T10:00:00.000Z' })
    render(<InviteSettingsTab group={group} />, null, AllTheProviders({ orm: ormSession.state, pending: {} }))

    fireEvent.click(screen.getByText('Resend All'))

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to resend all Pending Invitations')
    confirmSpy.mockRestore()
  })

  it('reports how many addresses were submitted and sent with full access', async () => {
    mockCreateInvitation(() => HttpResponse.json({
      data: {
        createInvitation: {
          invitations: [
            { id: '41', email: 'one@example.com', createdAt: '2026-09-22T10:00:00.000Z', lastSentAt: '2026-09-22T10:00:00.000Z', error: null, status: null },
            { id: null, email: 'not-an-email', createdAt: null, lastSentAt: null, error: 'invalid', status: null }
          ]
        }
      }
    }))
    const group = { id: '1', name: 'Go Team', slug: 'goteam' }
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create(group)
    render(<InviteSettingsTab group={group} />, null, AllTheProviders({ orm: ormSession.state, pending: {} }))

    enterEmails('one@example.com, not-an-email')
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(await screen.findByText('Sent 1 invite')).toBeInTheDocument()
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invitations Sent', {
      numGood: 1,
      numSubmitted: 2,
      inviteAccess: 'full'
    })
  })
})
