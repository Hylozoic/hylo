import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import GlobalNav from './GlobalNav'

const mockNavigate = jest.fn()

jest.mock('react-use-intercom', () => ({
  useIntercom: () => ({ show: () => {} })
}))
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))
jest.mock('@hylo/navigation', () => {
  const actual = jest.requireActual('@hylo/navigation')
  return {
    ...actual,
    createGroupModalUrl: actual.createGroupModalUrl || (() => '/groups/create'),
    createPostModalUrl: actual.createPostModalUrl || (() => '/posts/create'),
    newMessageUrl: actual.newMessageUrl || (() => '/messages/new'),
    personUrl: actual.personUrl || (() => '/people'),
    myHomeLandingUrl: actual.myHomeLandingUrl || (() => '/my')
  }
})

function providersWithMe () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({
    id: '1',
    name: 'Test User',
    hasRegistered: true,
    emailValidated: true,
    settings: {
      signupInProgress: false,
      alreadySeenTour: true
    }
  })
  return AllTheProviders({ orm: ormSession.state })
}

function stateWithPinnedSpace () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  const me = ormSession.Me.create({ id: '1' })
  ormSession.Person.create({ id: me.id, name: 'Test User' })
  const parent = ormSession.Group.create({ id: 'parent-id', name: 'Parent', slug: 'parent', avatarUrl: '/parent-avatar.jpg' })
  const space = ormSession.Group.create({
    id: 'space-id',
    name: 'Pinned Space',
    slug: 'parent-space',
    type: 'space',
    parentId: parent.id,
    icon: 'Sparkles'
  })
  const customAvatarSpace = ormSession.Group.create({
    id: 'custom-space-id',
    name: 'Custom Avatar Space',
    slug: 'parent-custom-space',
    type: 'space',
    parentId: parent.id,
    avatarUrl: '/space-avatar.jpg',
    icon: 'Users'
  })
  const unpinnedSpace = ormSession.Group.create({
    id: 'unpinned-space-id',
    name: 'Unpinned Space',
    slug: 'parent-unpinned',
    type: 'space',
    parentId: parent.id
  })
  ormSession.Membership.create({ id: 'm-parent', group: parent.id, person: me.id, navOrder: null })
  ormSession.Membership.create({ id: 'm-space', group: space.id, person: me.id, navOrder: 0 })
  ormSession.Membership.create({ id: 'm-custom-space', group: customAvatarSpace.id, person: me.id, navOrder: 1 })
  ormSession.Membership.create({ id: 'm-unpinned-space', group: unpinnedSpace.id, person: me.id, navOrder: null })
  return { orm: ormSession.state }
}

function mockGlobalNavRequests () {
  mockGraphqlServer.use(
    graphql.query('MeQuery', () => HttpResponse.json({ data: { me: null } })),
    graphql.query('FetchForGroup', () => HttpResponse.json({ data: { group: null } })),
    graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group: null } })),
    graphql.query('PostsQuery', () => HttpResponse.json({ data: { group: null } })),
    graphql.query('GroupPostsQuery', () => HttpResponse.json({ data: { group: null } })),
    graphql.query('MessageThreadsQuery', () => HttpResponse.json({ data: { me: null } })),
    graphql.query('MyPendingJoinRequestsQuery', () => HttpResponse.json({ data: { joinRequests: null } })),
    graphql.query('NotificationsQuery', () => HttpResponse.json({ data: { notifications: null } }))
  )
}

describe('GlobalNav', () => {
  it('renders as expected with no group', async () => {
    mockGlobalNavRequests()

    const { container } = render(
      <GlobalNav routeParams={{ context: 'all', view: 'all' }} />,
      { wrapper: providersWithMe() }
    )

    await waitFor(() => {
      expect(container.querySelector('.globalNavContainer')).toBeInTheDocument()
    })
  })

  it('renders only pinned spaces in the pinned rail and navigates with the parent route', async () => {
    mockGlobalNavRequests()
    mockNavigate.mockClear()
    render(
      <GlobalNav
        currentUser={{ id: '1', settings: { alreadySeenTour: true } }}
        routeParams={{ context: 'groups', groupSlug: 'parent', view: 'all' }}
      />,
      { wrapper: AllTheProviders(stateWithPinnedSpace(), ['/groups/parent']) }
    )

    const pinnedSpace = await screen.findByTestId('global-nav-space-space-id')
    expect(pinnedSpace).toHaveAttribute('aria-label', 'Pinned Space')
    const spaceIconBadge = screen.getByTestId('pinned-space-icon-space-id')
    expect(spaceIconBadge).toHaveClass('top-1', 'left-1', 'h-6', 'w-6', 'rounded-full', 'bg-[hsl(0_0%_17%)]', 'text-white')
    expect(spaceIconBadge.querySelector('svg')).toBeInTheDocument()
    const spaceAvatarTile = screen.getByTestId('pinned-space-space-avatar-space-id')
    expect(spaceAvatarTile).toHaveClass('bg-transparent')
    expect(spaceAvatarTile.style.backgroundImage).toBe('')
    const parentAvatarTile = screen.getByTestId('pinned-space-parent-avatar-space-id')
    expect(parentAvatarTile).not.toHaveClass('border-foreground/20')
    expect(parentAvatarTile.style.backgroundImage).toContain('parent-avatar.jpg')
    expect(screen.queryByRole('button', { name: 'Unpinned Space' })).not.toBeInTheDocument()

    const customAvatarTile = screen.getByTestId('global-nav-space-custom-space-id')
    expect(customAvatarTile).toHaveStyle({ backgroundImage: 'url(/space-avatar.jpg)' })
    expect(screen.queryByTestId('pinned-space-stack-custom-space-id')).not.toBeInTheDocument()

    fireEvent.click(pinnedSpace)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/groups/parent/spaces/space')
    })
  })
})
