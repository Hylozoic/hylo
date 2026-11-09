import React from 'react'
import userEvent from '@testing-library/user-event'
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
    expect(screen.getByText('Invite Links')).toBeInTheDocument()
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
    expect(screen.getByText('To see the group and join')).toBeInTheDocument()
    expect(screen.queryByText('Invite Links')).not.toBeInTheDocument()
  })

  it('shows the public link and grant-access invite links for a public restricted group', () => {
    const group = {
      id: 1,
      name: 'Hylo',
      slug: 'hylo',
      visibility: GROUP_VISIBILITY.Public,
      accessibility: GROUP_ACCESSIBILITY.Restricted
    }

    render(<InviteSettingsTab group={group} />)

    expect(screen.getByText('To see the group and request to join.')).toBeInTheDocument()
    expect(screen.getByText('Grant access to the group without a request.')).toBeInTheDocument()
    expect(screen.queryByText('Let someone see the group and request to join.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create View Link' })).not.toBeInTheDocument()
  })

  it('tells people a public closed group link does not let them join', () => {
    const group = {
      id: 1,
      name: 'Hylo',
      slug: 'hylo',
      visibility: GROUP_VISIBILITY.Public,
      accessibility: GROUP_ACCESSIBILITY.Closed
    }

    render(<InviteSettingsTab group={group} />)

    expect(screen.getByText('To see the group profile. They will not be able to join the group.')).toBeInTheDocument()
    expect(screen.getByText('Grant access to the group.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create View Link' })).not.toBeInTheDocument()
  })

  it('uses the same invite link explainer for protected and hidden closed groups', () => {
    for (const visibility of [GROUP_VISIBILITY.Protected, GROUP_VISIBILITY.Hidden]) {
      const group = { id: 1, name: 'Hylo', slug: 'hylo', visibility, accessibility: GROUP_ACCESSIBILITY.Closed }
      const { unmount } = render(<InviteSettingsTab group={group} />)

      expect(screen.getByText('Grant access to the group.')).toBeInTheDocument()
      expect(screen.queryByText('Because this group is Closed, even if someone can see this group they still need an invite to join.')).not.toBeInTheDocument()
      unmount()
    }
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
    expect(screen.getByText('Invite Links')).toBeInTheDocument()
    expect(screen.getByText(/An invitation link will be sent to each email address to join this space. If they are not yet a member of Hylo they will be asked to join that first./)).toBeInTheDocument()
  })

  it('loads recent contacts by default and searches people when text is entered', async () => {
    const queries = []
    mockGraphqlServer.use(
      graphql.operation(({ query, variables }) => {
        queries.push({ query, variables })
        if (query.includes('connections')) {
          return HttpResponse.json({
            data: {
              connections: {
                hasMore: false,
                items: [
                  { id: 'c1', person: { id: '2', name: 'Recent Ada', avatarUrl: null } },
                  { id: 'c2', person: { id: '3', name: '   ', avatarUrl: null } }
                ]
              }
            }
          })
        }
        if (query.includes('people (')) {
          return HttpResponse.json({
            data: {
              people: {
                hasMore: false,
                items: [
                  { id: '8', name: 'Search Bea', avatarUrl: null },
                  { id: '9', name: '   ', avatarUrl: null }
                ]
              }
            }
          })
        }
        return HttpResponse.json({ data: {} })
      })
    )

    const group = { id: '42', name: 'Hylo', slug: 'hylo', visibility: GROUP_VISIBILITY.Protected, accessibility: GROUP_ACCESSIBILITY.Restricted }
    render(<InviteSettingsTab group={group} />)

    await waitFor(() => {
      const recent = queries.find(q => q.query.includes('connections') && String(q.variables?.excludeGroupId) === '42')
      expect(recent).toBeTruthy()
    })
    expect(queries.some(q => q.query.includes('people (') && String(q.variables?.excludeGroupId) === '42')).toBe(false)

    fireEvent.focus(screen.getByPlaceholderText('Search people...'))
    expect(await screen.findByText('Recent Ada')).toBeInTheDocument()
    expect(screen.queryByText('Search Bea')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    fireEvent.change(screen.getByPlaceholderText('Search people...'), { target: { value: 'Bea' } })

    await waitFor(() => {
      const search = queries.find(q => q.query.includes('people (') && String(q.variables?.excludeGroupId) === '42')
      expect(search?.variables?.autocomplete).toBe('Bea')
    })
    expect(await screen.findByText('Search Bea')).toBeInTheDocument()
    expect(screen.queryByText('Recent Ada')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('keeps a space invite list on parent members when the search is empty', async () => {
    const queries = []
    mockGraphqlServer.use(
      graphql.operation(({ query, variables }) => {
        queries.push({ query, variables })
        return HttpResponse.json({ data: {} })
      })
    )

    render(
      <InviteSettingsTab
        group={{
          id: '2',
          name: 'Space',
          slug: 'space',
          type: GROUP_TYPES.space,
          parentId: '1',
          visibility: GROUP_VISIBILITY.Protected,
          accessibility: GROUP_ACCESSIBILITY.Open
        }}
        parentGroup={{ id: '1', name: 'Hylo' }}
      />
    )

    await waitFor(() => {
      expect(queries.some(q => q.query.includes('members'))).toBe(true)
    })
    expect(queries.some(q => q.query.includes('connections'))).toBe(false)
  })
})

describe('InviteSettingsTab pending invites', () => {
  const baseGroup = {
    id: '1',
    name: 'Go Team',
    slug: 'goteam',
    visibility: GROUP_VISIBILITY.Protected,
    accessibility: GROUP_ACCESSIBILITY.Restricted,
    myInviteAllowance: 7,
    inviteLinks: [{ id: '9', accessCode: 'Abcdefghij', url: '/invite/Abcdefghij', grantAccess: true }],
    groupRoles: { items: [{ id: '5', name: 'Host', active: true }] }
  }

  const adminRole = {
    id: '3',
    groupId: '1',
    name: 'Administrator',
    responsibilities: { items: [{ id: '1', title: 'Administration' }] }
  }

  function providers (group, { allowance, roles = [] } = {}) {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create({ ...group, myInviteAllowance: allowance === undefined ? group.myInviteAllowance : allowance })
    ormSession.Person.create({ id: '7', name: 'Ada Member' })
    ormSession.Invitation.create({ id: '31', email: 'first@example.com', group: group.id, creator: '7', createdAt: '2026-09-20T10:00:00.000Z', lastSentAt: '2026-09-20T10:00:00.000Z' })
    ormSession.Invitation.create({ id: '32', email: 'second@example.com', group: group.id, createdAt: '2026-09-21T10:00:00.000Z', lastSentAt: '2026-09-21T10:00:00.000Z' })
    ormSession.Me.create({ id: '10', name: 'Tester', groupRoles: { items: roles } })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  function renderTab ({ inModal = false, allowance, roles = [], group: groupOverrides = {} } = {}) {
    const group = { ...baseGroup, ...groupOverrides }
    return render(<InviteSettingsTab group={group} inModal={inModal} />, null, providers(group, { allowance, roles }))
  }

  it('labels a named link and marks one that grants access', () => {
    renderTab({
      group: {
        inviteLinks: [{
          id: '9',
          name: 'Front door',
          accessCode: 'Abcdefghij',
          url: '/invite/Abcdefghij',
          grantAccess: true,
          grantedRoles: [{ id: '5', name: 'Host', emoji: '👋' }]
        }]
      }
    })

    const name = screen.getByText('Front door')
    const url = screen.getByText(/\/invite\/Abcdefghij/)
    expect(name.compareDocumentPosition(url) & window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Grants Role(s):')).toBeInTheDocument()
    expect(screen.getByText('👋 Host')).toBeInTheDocument()
    expect(screen.getByTestId('invite-link-grants-access')).toHaveAttribute(
      'data-tooltip-content',
      'This link will grant access to the group without requesting to join'
    )
    expect(screen.queryByRole('button', { name: 'Invite link actions' })).not.toBeInTheDocument()
  })

  it('shows granted roles under a link that has no name', () => {
    renderTab({
      group: {
        inviteLinks: [{
          id: '9',
          accessCode: 'Abcdefghij',
          url: '/invite/Abcdefghij',
          grantAccess: true,
          grantedRoles: [{ id: '5', name: 'Host', emoji: null }]
        }]
      }
    })

    expect(screen.getByText('Grants Role(s):')).toBeInTheDocument()
    expect(screen.getByText('Host')).toBeInTheDocument()
  })

  it('puts view links in their own section above invite links', () => {
    renderTab({
      group: {
        inviteLinks: [
          { id: '9', accessCode: 'InviteCode', url: '/invite/InviteCode', grantAccess: true },
          { id: '10', accessCode: 'ViewCode11', url: '/view/ViewCode11', grantAccess: false }
        ]
      }
    })

    const viewUrl = screen.getByText(/\/view\/ViewCode11/)
    const inviteUrl = screen.getByText(/\/invite\/InviteCode/)
    expect(viewUrl.compareDocumentPosition(inviteUrl) & window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText(/\/invite\/ViewCode11/)).not.toBeInTheDocument()
  })

  it('shows a spinner while links are still loading', async () => {
    let releaseLinks
    const linksReady = new Promise(resolve => { releaseLinks = resolve })
    mockGraphqlServer.use(
      graphql.operation(async ({ query }) => {
        if (String(query).includes('inviteLinks')) await linksReady
        return HttpResponse.json({ data: {} })
      })
    )

    const group = { id: 1, name: 'Hylo', slug: 'hylo', visibility: GROUP_VISIBILITY.Protected, accessibility: GROUP_ACCESSIBILITY.Restricted }
    render(<InviteSettingsTab group={group} />)

    expect(await screen.findAllByTestId('loading-indicator')).not.toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'View Links' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Invite Links' })).toBeInTheDocument()
    releaseLinks()
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    })
  })

  it('marks a view-only link with an eye and a /view path', () => {
    renderTab({
      group: {
        inviteLinks: [{ id: '9', accessCode: 'Abcdefghij', url: '/invite/Abcdefghij', grantAccess: false }]
      }
    })

    const icon = screen.getByTestId('invite-link-view-only')
    expect(icon).toHaveAttribute(
      'data-tooltip-content',
      'Gives access to view the group, but people still have to request to join.'
    )
    expect(icon.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText(/\/view\/Abcdefghij/)).toBeInTheDocument()
    expect(screen.queryByText(/\/invite\/Abcdefghij/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('invite-link-grants-access')).not.toBeInTheDocument()
  })

  it('uses the shorter grant tooltip for a Closed group', () => {
    renderTab({
      group: {
        accessibility: GROUP_ACCESSIBILITY.Closed,
        inviteLinks: [{ id: '9', accessCode: 'Abcdefghij', url: '/invite/Abcdefghij', grantAccess: true }]
      }
    })

    expect(screen.getByTestId('invite-link-grants-access')).toHaveAttribute(
      'data-tooltip-content',
      'This link will grant access to the group'
    )
  })

  it('lets a hidden open group keep multiple invite links', () => {
    renderTab({
      roles: [adminRole],
      group: {
        accessibility: GROUP_ACCESSIBILITY.Open,
        visibility: GROUP_VISIBILITY.Hidden,
        inviteLinks: [
          { id: '9', accessCode: 'Abcdefghij', url: '/invite/Abcdefghij', grantAccess: true },
          { id: '10', accessCode: 'SecondLink', url: '/invite/SecondLink', grantAccess: true }
        ]
      }
    })

    expect(screen.getByText('Invite Links')).toBeInTheDocument()
    expect(screen.queryByText('Group Link')).not.toBeInTheDocument()
    expect(screen.getByText('This group is hidden. Anyone with an invite link can see it and join.')).toBeInTheDocument()
    expect(screen.getByText(/\/invite\/Abcdefghij/)).toBeInTheDocument()
    expect(screen.getByText(/\/invite\/SecondLink/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create invite link' })).toBeInTheDocument()
  })

  it('lets a protected open group keep multiple invite links', () => {
    renderTab({
      roles: [adminRole],
      group: {
        accessibility: GROUP_ACCESSIBILITY.Open,
        visibility: GROUP_VISIBILITY.Protected,
        inviteLinks: [
          { id: '9', accessCode: 'Abcdefghij', url: '/invite/Abcdefghij', grantAccess: true },
          { id: '10', accessCode: 'SecondLink', url: '/invite/SecondLink', grantAccess: true }
        ]
      }
    })

    expect(screen.getByText('Invite Links')).toBeInTheDocument()
    expect(screen.queryByText('Group Link')).not.toBeInTheDocument()
    expect(screen.getByText('Anyone invited can see the group and join.')).toBeInTheDocument()
    expect(screen.getByText(/\/invite\/Abcdefghij/)).toBeInTheDocument()
    expect(screen.getByText(/\/invite\/SecondLink/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create invite link' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create View Link' })).not.toBeInTheDocument()
  })

  it('lets an administrator create a link and edit one from the menu', async () => {
    const user = userEvent.setup()
    renderTab({ roles: [adminRole] })

    expect(screen.getByRole('button', { name: 'Create invite link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create View Link' })).toHaveAttribute(
      'data-tooltip-content',
      'These links allow for viewing the group, but still require a request to join.'
    )
    await user.click(screen.getByRole('button', { name: 'Invite link actions' }))
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

    expect(screen.getByPlaceholderText('Name (optional)')).toBeInTheDocument()
    expect(screen.queryByText('Grant access')).not.toBeInTheDocument()
    expect(screen.getByText('Add a role this link grants')).toBeInTheDocument()
  })

  it('opens a view link without a role picker', async () => {
    const user = userEvent.setup()
    renderTab({ roles: [adminRole] })

    await user.click(screen.getByRole('button', { name: 'Create View Link' }))

    expect(screen.getByPlaceholderText('Name (optional)')).toBeInTheDocument()
    expect(screen.queryByText('Grant access')).not.toBeInTheDocument()
    expect(screen.queryByText('Add a role this link grants')).not.toBeInTheDocument()
  })

  it('shows invite links, email invites, the allowance and pending invites', () => {
    renderTab()

    const viewHeading = screen.getByRole('heading', { name: 'View Links' })
    const inviteHeading = screen.getByRole('heading', { name: 'Invite Links' })
    expect(viewHeading.compareDocumentPosition(inviteHeading) & window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Let someone see the group and request to join.')).toBeInTheDocument()
    expect(screen.getByText('Grant access to the group without a request.')).toBeInTheDocument()
    expect(screen.getByText('Invite people on Hylo')).toBeInTheDocument()
    expect(screen.getByText('Send Invites via email')).toBeInTheDocument()
    expect(screen.getByText('Enter up to 10 email addresses at a time, separated by commas or new lines')).toBeInTheDocument()
    expect(screen.getByText('Invites left today: 7')).toBeInTheDocument()
    expect(screen.getByText('Pending Invites')).toBeInTheDocument()
    expect(screen.getByText('Resend All')).toBeInTheDocument()
    expect(screen.getByText('first@example.com')).toBeInTheDocument()
    expect(screen.getByText(/Invited by Ada Member/)).toBeInTheDocument()
    expect(screen.queryByText('Assign a role to invitees (optional):')).not.toBeInTheDocument()
  })

  it('hides Resend All in the invite dialog', () => {
    renderTab({ inModal: true })

    expect(screen.getByText('Pending Invites')).toBeInTheDocument()
    expect(screen.queryByText('Resend All')).not.toBeInTheDocument()
  })

  it('asks before resending every pending invitation', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => false)
    renderTab()

    fireEvent.click(screen.getByText('Resend All'))

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to resend all Pending Invitations')
    confirmSpy.mockRestore()
  })

  it('sends email addresses and reports how many were sent', async () => {
    const requests = mockCreateInvitation(() => HttpResponse.json({
      data: {
        createInvitation: {
          invitations: [
            { id: '41', email: 'new@example.com', error: null },
            { id: '42', email: 'member@example.com', error: null },
            { id: null, email: 'not-an-email', error: 'not a valid email address' }
          ]
        }
      }
    }))
    renderTab()

    enterEmails('new@example.com, member@example.com, not-an-email')
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(await screen.findByText('Sent 2 invites')).toBeInTheDocument()
    expect(screen.getByText(/1 invalid email address\/es found/)).toBeInTheDocument()
    expect(requests).toHaveLength(1)
    expect(requests[0].data).toEqual({
      emails: ['new@example.com', 'member@example.com', 'not-an-email'],
      userIds: [],
      groupRoleId: null
    })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invitations Sent', {
      numGood: 2,
      numSubmitted: 3
    })
  })

  it('shows the over-limit message when the allowance would be exceeded', async () => {
    mockCreateInvitation(() => HttpResponse.json({ errors: [{ message: 'invite-limit' }], data: { createInvitation: null } }))
    renderTab()

    enterEmails('one@example.com, two@example.com')
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(await screen.findByText("You don't have enough invites left today for all of these addresses.")).toBeInTheDocument()
    expect(trackAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('does not send more than 10 different addresses at a time', () => {
    const requests = mockCreateInvitation(() => HttpResponse.json({ data: { createInvitation: { invitations: [] } } }))
    renderTab()

    enterEmails(Array.from({ length: 11 }, (_, i) => `person${i}@example.com`).join('\n'))
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }))

    expect(screen.getByText('You can invite up to 10 people at a time')).toBeInTheDocument()
    expect(requests).toHaveLength(0)
  })

  it('disables sending when no invites are left today', () => {
    renderTab({ allowance: 0 })

    enterEmails('one@example.com')

    expect(screen.getByText('Invites left today: 0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send Invite/i })).toHaveClass('disabled')
  })
})
