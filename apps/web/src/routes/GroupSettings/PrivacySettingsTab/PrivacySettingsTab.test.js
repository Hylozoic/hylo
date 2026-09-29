import React from 'react'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'store/models/Group'
import PrivacySettingsTab from './PrivacySettingsTab'

jest.mock('store/actions/trackAnalyticsEvent', () => {
  const actual = jest.requireActual('store/actions/trackAnalyticsEvent')
  return { __esModule: true, default: jest.fn(actual.default) }
})

describe('PrivacySettingsTab', () => {
  it('renders correctly', () => {
    const group = {
      id: 1,
      name: 'Foomunity',
      slug: 'foo',
      locationObject: 'Fuji',
      description: 'Great group',
      avatarUrl: 'avatar.png',
      bannerUrl: 'avatar.png',
      accessibility: 1,
      visibility: 1
    }

    render(<PrivacySettingsTab group={group} parentGroups={[]} />)

    // Check for key elements
    expect(screen.getByText('Visibility')).toBeInTheDocument()
    expect(screen.getByText('Access')).toBeInTheDocument()
    expect(screen.getByText('Join Questions')).toBeInTheDocument()
    expect(screen.getByText('Prerequisite Groups')).toBeInTheDocument()
    expect(screen.getByText('Group Access Questions')).toBeInTheDocument()

    // Check for group name in the rendered content
    expect(screen.getByText(/Who is able to see/)).toBeInTheDocument()
    expect(screen.getByText(/How can people become members of/)).toBeInTheDocument()

    // Check for the save button
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })
})

describe('PrivacySettingsTab "Who can add new members?"', () => {
  const WHO_CAN_ADD = 'Who can add new members?'
  const APPROVAL = 'Every member can send personal email invitations. A steward approves each person they invite before they join.'
  const NO_APPROVAL = 'Every member can send personal email invitations, and the people they invite join right away.'

  const groupRoles = {
    items: [
      { id: '1', name: 'Administrator', emoji: '🪄', type: 'system', active: true },
      { id: '2', name: 'Moderator', emoji: '⚖️', type: 'system', active: true },
      { id: '3', name: 'Host', emoji: '👋', type: 'system', active: true },
      { id: '12', name: 'Door Keeper', emoji: '🚪', type: 'custom', active: true, responsibilities: { items: [{ id: '5', title: 'Add Members' }] } },
      { id: '13', name: 'Gardener', emoji: '🌱', type: 'custom', active: true, responsibilities: { items: [] } },
      { id: '14', name: 'Retired', emoji: '💤', type: 'custom', active: false }
    ]
  }

  const baseGroup = {
    id: '1',
    name: 'Seed Library',
    slug: 'seed-library',
    accessibility: GROUP_ACCESSIBILITY.Restricted,
    visibility: GROUP_VISIBILITY.Protected,
    settings: {},
    groupRoles,
    invitePolicy: { mode: 'stewards', roleIds: [] }
  }

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

  function renderTab (overrides = {}, saveResult = {}) {
    const updateGroupSettings = jest.fn(() => Promise.resolve(saveResult))
    render(<PrivacySettingsTab group={{ ...baseGroup, ...overrides }} parentGroups={[]} updateGroupSettings={updateGroupSettings} />)
    return updateGroupSettings
  }

  function choose (optionTitle) {
    fireEvent.click(screen.getByRole('button', { name: WHO_CAN_ADD }))
    fireEvent.click(screen.getByRole('button', { name: optionTitle }))
  }

  it('shows the current policy', () => {
    renderTab()

    expect(screen.getByRole('heading', { name: WHO_CAN_ADD })).toBeInTheDocument()
    expect(screen.getByText('Choose who can invite people to join Seed Library. Administrators, Moderators and Hosts can always invite.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: WHO_CAN_ADD })).toHaveTextContent('Stewards (Administrators, Moderators and Hosts)')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('lists active roles for specific roles, with stewards and roles that include Add Members locked on', () => {
    renderTab({ invitePolicy: { mode: 'roles', roleIds: ['2', '13'] } })

    for (const name of ['🪄 Administrator', '⚖️ Moderator', '👋 Host', '🚪 Door Keeper']) {
      const checkbox = screen.getByRole('checkbox', { name })
      expect(checkbox).toBeDisabled()
      expect(checkbox).toHaveAttribute('aria-checked', 'true')
    }
    expect(screen.getByRole('checkbox', { name: '🌱 Gardener' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('checkbox', { name: '💤 Retired' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create or edit roles in Roles & Badges' })).toHaveAttribute('href', '/groups/seed-library/settings/roles')
  })

  it('saves the chosen roles with the other settings', () => {
    const updateGroupSettings = renderTab()

    choose('Specific roles')
    fireEvent.click(screen.getByRole('checkbox', { name: '🌱 Gardener' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(updateGroupSettings).toHaveBeenCalledTimes(1)
    expect(updateGroupSettings.mock.calls[0][0]).toMatchObject({
      accessibility: GROUP_ACCESSIBILITY.Restricted,
      invitePolicy: { mode: 'roles', roleIds: ['13'] }
    })
  })

  it('saves everyone', async () => {
    const updateGroupSettings = renderTab({ invitePolicy: { mode: 'roles', roleIds: ['13'] } })

    choose('Everyone in the group')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(updateGroupSettings.mock.calls[0][0].invitePolicy).toEqual({ mode: 'everyone' })
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invite Policy Set', { mode: 'everyone', surface: 'settings' }))
  })

  it('reports a policy only once it has saved', async () => {
    const updateGroupSettings = renderTab({}, { error: true })

    choose('Everyone in the group')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updateGroupSettings).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(trackAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('does not resend the policy when only other settings change', async () => {
    const updateGroupSettings = renderTab({ invitePolicy: { mode: 'everyone', roleIds: [] } })

    fireEvent.click(screen.getByText('Public'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(updateGroupSettings).toHaveBeenCalledTimes(1)
    expect(updateGroupSettings.mock.calls[0][0]).not.toHaveProperty('invitePolicy')
    await Promise.resolve()
    expect(trackAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('describes the approval step for the access setting being edited', () => {
    renderTab({ accessibility: GROUP_ACCESSIBILITY.Open, invitePolicy: { mode: 'everyone', roleIds: [] } })
    expect(screen.getByText(NO_APPROVAL)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Restricted'))
    expect(screen.getByText(APPROVAL)).toBeInTheDocument()
  })

  it('is hidden when the policy was not loaded', () => {
    renderTab({ invitePolicy: null })
    expect(screen.queryByRole('heading', { name: WHO_CAN_ADD })).not.toBeInTheDocument()
  })

  it('is hidden when the server has member invitations switched off', () => {
    process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'on'
    const session = orm.mutableSession(orm.getEmptyState())
    session.Me.create({ id: '10', name: 'Administrator', memberInvitesEnabled: false })
    const updateGroupSettings = jest.fn(() => Promise.resolve({}))
    render(
      <PrivacySettingsTab group={{ ...baseGroup, invitePolicy: { mode: 'stewards', roleIds: [] } }} parentGroups={[]} updateGroupSettings={updateGroupSettings} />,
      null,
      AllTheProviders({ orm: session.state })
    )

    expect(screen.queryByRole('heading', { name: WHO_CAN_ADD })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(updateGroupSettings.mock.calls[0][0]).not.toHaveProperty('invitePolicy')
  })

  it('is hidden while member invitations are switched off', () => {
    process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'off'
    const updateGroupSettings = renderTab({ invitePolicy: { mode: 'roles', roleIds: ['13'] } })

    expect(screen.queryByRole('heading', { name: WHO_CAN_ADD })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(updateGroupSettings.mock.calls[0][0]).not.toHaveProperty('invitePolicy')
  })
})
