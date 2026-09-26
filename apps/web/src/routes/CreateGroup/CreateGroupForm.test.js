import React, { createRef } from 'react'
import { graphql, HttpResponse } from 'msw'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { act, AllTheProviders, fireEvent, render as renderWithProviders, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import CreateGroupForm from './CreateGroupForm'

jest.mock('store/actions/trackAnalyticsEvent', () => {
  const actual = jest.requireActual('store/actions/trackAnalyticsEvent')
  return { __esModule: true, default: jest.fn(actual.default) }
})

const WHO_CAN_ADD = 'Who can add new members?'
const STEWARDS = 'Administrators and Hosts (anyone who can add members)'
const CLOSED_WITH_MEMBER_INVITES = 'Nobody can request to join on their own. People arrive by invitation; invitations from members are reviewed by stewards.'
const CLOSED_WITHOUT_MEMBER_INVITES = 'Nobody can request to join. Members arrive only when a steward invites them directly or shares an invite link.'

function mockGraphql () {
  const createGroupRequests = []
  mockGraphqlServer.use(
    graphql.operation(({ query, variables }) => {
      if (query.includes('groupExists')) {
        return HttpResponse.json({ data: { groupExists: { exists: false } } })
      }
      if (query.includes('createGroup')) {
        createGroupRequests.push(variables.data)
        return HttpResponse.json({
          data: {
            createGroup: {
              id: '99',
              name: variables.data.name,
              slug: variables.data.slug,
              parentGroups: { items: [] },
              groupRoles: { items: [] },
              memberships: { items: [{ id: '500', person: { id: '10' }, settings: {} }] }
            }
          }
        })
      }
      return HttpResponse.json({ data: {} })
    })
  )
  return createGroupRequests
}

function render (ui) {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '10', name: 'Founder', groupRoles: { items: [] } })
  return renderWithProviders(ui, null, AllTheProviders({ orm: session.state }))
}

function choose (settingLabel, optionTitle) {
  fireEvent.click(screen.getByRole('button', { name: settingLabel }))
  fireEvent.click(screen.getByRole('button', { name: optionTitle }))
}

async function createNamedGroup () {
  fireEvent.change(screen.getByPlaceholderText('Name your group'), { target: { value: 'Seed Library' } })
  const submit = screen.getByRole('button', { name: /Create Group/ })
  await waitFor(() => expect(submit).toBeEnabled())
  fireEvent.click(submit)
}

describe('CreateGroupForm "Who can add new members?"', () => {
  let savedFlag

  beforeEach(() => {
    savedFlag = process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    trackAnalyticsEvent.mockClear()
  })

  afterEach(() => {
    if (savedFlag === undefined) {
      delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    } else {
      process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = savedFlag
    }
  })

  it('starts on Administrators and Hosts and offers everyone and specific roles', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    expect(screen.getByText(WHO_CAN_ADD)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: WHO_CAN_ADD })).toHaveTextContent(STEWARDS)

    fireEvent.click(screen.getByRole('button', { name: WHO_CAN_ADD }))
    expect(screen.getByRole('button', { name: 'Everyone in the group' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Specific roles' })).toBeInTheDocument()
  })

  it('lets specific roles add Moderators, with Administrators and Hosts locked on', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    choose(WHO_CAN_ADD, 'Specific roles')

    const administrator = screen.getByRole('checkbox', { name: '🪄 Administrator' })
    const host = screen.getByRole('checkbox', { name: '👋 Host' })
    const moderator = screen.getByRole('checkbox', { name: '⚖️ Moderator' })
    expect(administrator).toBeDisabled()
    expect(administrator).toHaveAttribute('aria-checked', 'true')
    expect(host).toBeDisabled()
    expect(host).toHaveAttribute('aria-checked', 'true')
    expect(moderator).toBeEnabled()
    expect(moderator).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Create custom roles later in Roles & Badges')).toBeInTheDocument()

    fireEvent.click(moderator)
    expect(moderator).toHaveAttribute('aria-checked', 'false')
  })

  it('sends the chosen policy in createGroup', async () => {
    const requests = mockGraphql()
    render(<CreateGroupForm />)

    choose(WHO_CAN_ADD, 'Specific roles')
    await createNamedGroup()

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].invitePolicy).toEqual({ mode: 'roles', systemRoleNames: ['Moderator'] })
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invite Policy Set', { mode: 'roles', surface: 'create' }))
  })

  it('sends stewards when specific roles adds no one', async () => {
    const requests = mockGraphql()
    render(<CreateGroupForm />)

    choose(WHO_CAN_ADD, 'Specific roles')
    fireEvent.click(screen.getByRole('checkbox', { name: '⚖️ Moderator' }))
    await createNamedGroup()

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].invitePolicy).toEqual({ mode: 'stewards' })
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invite Policy Set', { mode: 'stewards', surface: 'create' }))
  })

  it('sends everyone', async () => {
    const requests = mockGraphql()
    render(<CreateGroupForm />)

    choose(WHO_CAN_ADD, 'Everyone in the group')
    await createNamedGroup()

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].invitePolicy).toEqual({ mode: 'everyone' })
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invite Policy Set', { mode: 'everyone', surface: 'create' }))
  })

  it('counts a changed policy as entered data', () => {
    mockGraphql()
    const ref = createRef()
    const onClose = jest.fn()
    render(<CreateGroupForm ref={ref} onClose={onClose} />)

    choose(WHO_CAN_ADD, 'Everyone in the group')
    act(() => ref.current.requestClose())

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Discard this group?')).toBeInTheDocument()
  })

  it('closes without asking when nothing was entered', () => {
    mockGraphql()
    const ref = createRef()
    const onClose = jest.fn()
    render(<CreateGroupForm ref={ref} onClose={onClose} />)

    act(() => ref.current.requestClose())

    expect(onClose).toHaveBeenCalled()
  })

  it('describes Closed groups with member invitations reviewed by stewards', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    choose('Who can join this group?', 'By invitation only')

    expect(screen.getByText(CLOSED_WITH_MEMBER_INVITES)).toBeInTheDocument()
  })

  describe('while member invitations are switched off', () => {
    beforeEach(() => {
      process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'off'
    })

    it('hides the setting, keeps the Closed description and sends no policy', async () => {
      const requests = mockGraphql()
      render(<CreateGroupForm />)

      expect(screen.queryByText(WHO_CAN_ADD)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: WHO_CAN_ADD })).not.toBeInTheDocument()

      choose('Who can join this group?', 'By invitation only')
      expect(screen.getByText(CLOSED_WITHOUT_MEMBER_INVITES)).toBeInTheDocument()
      expect(screen.queryByText(CLOSED_WITH_MEMBER_INVITES)).not.toBeInTheDocument()

      await createNamedGroup()
      await waitFor(() => expect(requests).toHaveLength(1))
      expect(requests[0]).not.toHaveProperty('invitePolicy')
      expect(trackAnalyticsEvent).not.toHaveBeenCalledWith('Group Invite Policy Set', expect.anything())
    })
  })
})
