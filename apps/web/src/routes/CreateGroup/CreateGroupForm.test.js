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
const STEWARDS = 'Stewards (Administrators, Moderators and Hosts)'
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

function render (ui, me = {}) {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '10', name: 'Founder', groupRoles: { items: [] }, ...me })
  return renderWithProviders(ui, null, AllTheProviders({ orm: session.state }))
}

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Options may list their explanation after the title, so match on the title
function choose (settingLabel, optionTitle) {
  fireEvent.click(screen.getByRole('button', { name: settingLabel }))
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${escapeRegExp(optionTitle)}`) }))
}

async function createNamedGroup ({ visibility = 'Visible to related groups', accessibility = 'By request, with approval' } = {}) {
  fireEvent.change(screen.getByPlaceholderText('Name your group'), { target: { value: 'Seed Library' } })
  if (visibility) choose('Who can see this group?', visibility)
  if (accessibility) choose('Who can join this group?', accessibility)
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

  it('starts on Everyone in the group and offers stewards and specific roles', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    expect(screen.getByText(WHO_CAN_ADD)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: WHO_CAN_ADD })).toHaveTextContent('Everyone in the group')

    fireEvent.click(screen.getByRole('button', { name: WHO_CAN_ADD }))
    expect(screen.getByRole('button', { name: STEWARDS })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Specific roles' })).toBeInTheDocument()
  })

  it('sends the Everyone default when nothing else is chosen', async () => {
    const requests = mockGraphql()
    render(<CreateGroupForm />)

    await createNamedGroup()

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].invitePolicy).toEqual({ mode: 'everyone' })
  })

  it('offers everyone again after choosing stewards', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    choose(WHO_CAN_ADD, STEWARDS)
    expect(screen.getByRole('button', { name: WHO_CAN_ADD })).toHaveTextContent(STEWARDS)

    fireEvent.click(screen.getByRole('button', { name: WHO_CAN_ADD }))
    expect(screen.getByRole('button', { name: 'Everyone in the group' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Specific roles' })).toBeInTheDocument()
  })

  it('lists Administrators, Moderators and Hosts under specific roles, all locked on', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    choose(WHO_CAN_ADD, 'Specific roles')

    for (const name of ['🪄 Administrator', '⚖️ Moderator', '👋 Host']) {
      const role = screen.getByRole('checkbox', { name })
      expect(role).toBeDisabled()
      expect(role).toHaveAttribute('aria-checked', 'true')
    }
    expect(screen.getAllByText('Can always invite')).toHaveLength(3)
    expect(screen.getByText('Create custom roles later in Roles & Badges')).toBeInTheDocument()
  })

  it('sends stewards when specific roles adds no one beyond the stewards', async () => {
    const requests = mockGraphql()
    render(<CreateGroupForm />)

    choose(WHO_CAN_ADD, 'Specific roles')
    await createNamedGroup()

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].invitePolicy).toEqual({ mode: 'stewards' })
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invite Policy Set', { mode: 'stewards', surface: 'create' }))
  })

  it('sends everyone', async () => {
    const requests = mockGraphql()
    render(<CreateGroupForm />)

    choose(WHO_CAN_ADD, STEWARDS)
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

    choose(WHO_CAN_ADD, STEWARDS)
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

      await createNamedGroup({ accessibility: null })
      await waitFor(() => expect(requests).toHaveLength(1))
      expect(requests[0]).not.toHaveProperty('invitePolicy')
      expect(trackAnalyticsEvent).not.toHaveBeenCalledWith('Group Invite Policy Set', expect.anything())
    })
  })

  it('hides the setting and sends no policy when the server has member invitations switched off', async () => {
    process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'on'
    const requests = mockGraphql()
    render(<CreateGroupForm />, { memberInvitesEnabled: false })

    expect(screen.queryByRole('button', { name: WHO_CAN_ADD })).not.toBeInTheDocument()

    await createNamedGroup()
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0]).not.toHaveProperty('invitePolicy')
  })
})

describe('CreateGroupForm visibility and joining', () => {
  it('preselects neither, and keeps Create disabled with a note naming what is missing until both are chosen', async () => {
    const requests = mockGraphql()
    render(<CreateGroupForm />)

    fireEvent.change(screen.getByPlaceholderText('Name your group'), { target: { value: 'Seed Library' } })
    const submit = screen.getByRole('button', { name: /Create Group/ })
    expect(screen.getByRole('button', { name: 'Who can see this group?' })).toHaveTextContent('Choose who can see it')
    expect(screen.getByRole('button', { name: 'Who can join this group?' })).toHaveTextContent('Choose how people join')
    expect(screen.getByTestId('create-group-missing-choices')).toHaveTextContent('Choose who can see this group and who can join it.')
    expect(submit).toBeDisabled()

    choose('Who can see this group?', 'Anyone can find and see')
    expect(screen.getByTestId('create-group-missing-choices')).toHaveTextContent('Choose who can join this group.')
    expect(submit).toBeDisabled()

    choose('Who can join this group?', 'Anyone can join instantly')
    expect(screen.queryByTestId('create-group-missing-choices')).not.toBeInTheDocument()
    await waitFor(() => expect(submit).toBeEnabled())

    fireEvent.click(submit)
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0]).toMatchObject({ visibility: 2, accessibility: 2 })
  })

  it('names visibility alone when only joining is chosen', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    choose('Who can join this group?', 'By invitation only')
    expect(screen.getByTestId('create-group-missing-choices')).toHaveTextContent('Choose who can see this group.')
  })

  it('explains each option in the list', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Who can see this group?' }))
    expect(screen.getByText('This group will be exposed to search engines.')).toBeInTheDocument()
  })

  it('says Public groups are reviewed before they appear in the Group Explorer, instead of linking the commons form', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    expect(screen.queryByTestId('public-group-review-note')).not.toBeInTheDocument()
    choose('Who can see this group?', 'Anyone can find and see')
    expect(screen.getByTestId('public-group-review-note')).toHaveTextContent('Public groups are reviewed before they appear in the Group Explorer.')
    expect(screen.queryByText('Allow-in-Commons form')).not.toBeInTheDocument()
  })

  it('counts a chosen visibility as entered data', () => {
    mockGraphql()
    const ref = createRef()
    const onClose = jest.fn()
    render(<CreateGroupForm ref={ref} onClose={onClose} />)

    choose('Who can see this group?', 'Members only')
    act(() => ref.current.requestClose())

    expect(onClose).not.toHaveBeenCalled()
  })
})
