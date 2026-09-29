import React from 'react'
import userEvent from '@testing-library/user-event'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import SetupChecklist, { setupChecklistItems, setupChecklistVisible } from './SetupChecklist'

const fresh = {
  isCreator: true,
  hasOtherMembers: false,
  hasPostByOthers: false,
  hasCreatorPost: false,
  hasEvent: false,
  hasInvitation: false
}

describe('setupChecklistVisible', () => {
  it('shows to the founder of a group nobody else has joined', () => {
    expect(setupChecklistVisible({ checklist: fresh })).toBe(true)
  })

  it('is only for the founder', () => {
    expect(setupChecklistVisible({ checklist: { ...fresh, isCreator: false } })).toBe(false)
    expect(setupChecklistVisible({ checklist: null })).toBe(false)
  })

  it('goes away once a second member joins', () => {
    expect(setupChecklistVisible({ checklist: { ...fresh, hasOtherMembers: true } })).toBe(false)
  })

  it('goes away once someone other than the founder posts', () => {
    expect(setupChecklistVisible({ checklist: { ...fresh, hasPostByOthers: true } })).toBe(false)
  })

  it('stays away once dismissed', () => {
    expect(setupChecklistVisible({ checklist: fresh, dismissedAt: '2026-09-28T00:00:00.000Z' })).toBe(false)
  })

  it('keeps showing while the founder works through it', () => {
    expect(setupChecklistVisible({ checklist: { ...fresh, hasInvitation: true, hasCreatorPost: true, hasEvent: true } })).toBe(true)
  })
})

describe('setupChecklistItems', () => {
  it('leaves out Invite people for someone who cannot invite', () => {
    expect(setupChecklistItems(fresh, { canInvite: false }).map(item => item.id)).toEqual(['welcome-post', 'first-event'])
  })

  it('ticks each item when it is done', () => {
    expect(setupChecklistItems(fresh).map(item => item.done)).toEqual([false, false, false])
    expect(setupChecklistItems({ ...fresh, hasInvitation: true, hasEvent: true })).toEqual([
      { id: 'invite', done: true },
      { id: 'welcome-post', done: false },
      { id: 'first-event', done: true }
    ])
  })
})

describe('SetupChecklist', () => {
  const group = { id: '10', slug: 'new-group', name: 'New Group', memberCount: 1 }

  function renderChecklist ({ checklist = fresh, dismissedAt, administers = true } = {}) {
    const session = orm.mutableSession(orm.getEmptyState())
    const groupRoles = administers
      ? { items: [{ id: '1', groupId: group.id, name: 'Coordinator', responsibilities: { items: [{ id: '1', title: 'Administration' }, { id: '2', title: 'Add Members' }] } }] }
      : { items: [] }
    const me = session.Me.create({ id: '1', name: 'Founder', groupRoles })
    session.Group.create({ ...group, setupChecklist: checklist })
    session.Membership.create({ id: 'm1', group: group.id, person: me.id, settings: { setupChecklistDismissedAt: dismissedAt } })
    mockGraphqlServer.use(
      graphql.query('FetchGroupSetupChecklist', () => HttpResponse.json({ data: { group: { id: group.id, setupChecklist: checklist } } })),
      graphql.mutation('UpdateMembershipSettings', () => HttpResponse.json({ data: { updateMembership: { id: 'm1' } } }))
    )
    const groupFromStore = session.Group.withId(group.id)
    return render(<SetupChecklist group={groupFromStore} />, { wrapper: AllTheProviders({ orm: session.state }) })
  }

  it('shows the three items to the founder', () => {
    renderChecklist({ checklist: { ...fresh, hasInvitation: true } })
    expect(screen.getByText('Get your group started')).toBeInTheDocument()
    expect(screen.getByTestId('setup-checklist-invite')).toHaveAttribute('data-done', 'true')
    expect(screen.getByTestId('setup-checklist-welcome-post')).toHaveAttribute('data-done', 'false')
    expect(screen.getByTestId('setup-checklist-first-event')).toHaveAttribute('data-done', 'false')
  })

  it('renders nothing once someone else has joined', () => {
    renderChecklist({ checklist: { ...fresh, hasOtherMembers: true } })
    expect(screen.queryByTestId('setup-checklist')).not.toBeInTheDocument()
  })

  it('renders nothing after it was dismissed', () => {
    renderChecklist({ dismissedAt: '2026-09-28T00:00:00.000Z' })
    expect(screen.queryByTestId('setup-checklist')).not.toBeInTheDocument()
  })

  it('hides when dismissed', async () => {
    const user = userEvent.setup()
    renderChecklist()
    await user.click(screen.getByRole('button', { name: 'Dismiss setup checklist' }))
    await waitFor(() => {
      expect(screen.queryByTestId('setup-checklist')).not.toBeInTheDocument()
    })
  })

  it('opens the composer with the welcome template and for an event', async () => {
    const user = userEvent.setup()
    renderChecklist()
    await user.click(screen.getByTestId('setup-checklist-welcome-post'))
    expect(window.location.search).toContain('create=post')
    expect(window.location.search).toContain('template=welcome')

    await user.click(screen.getByTestId('setup-checklist-first-event'))
    expect(window.location.search).toContain('newPostType=event')
  })
})
