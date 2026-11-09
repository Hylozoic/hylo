import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import GlobalNav from './GlobalNav'

const mockNavigate = jest.fn()
let mockRouteParams = {}

jest.mock('hooks/useRouteParams', () => () => mockRouteParams)

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
  const noIconSpace = ormSession.Group.create({
    id: 'no-icon-space-id',
    name: 'No Icon Space',
    slug: 'parent-no-icon',
    type: 'space',
    parentId: parent.id
  })
  ormSession.Membership.create({ id: 'm-unpinned-space', group: unpinnedSpace.id, person: me.id, navOrder: null })
  ormSession.Membership.create({ id: 'm-no-icon-space', group: noIconSpace.id, person: me.id, navOrder: 2 })
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
    // The parent group's avatar fills the whole tile, like a group item
    expect(pinnedSpace).toHaveStyle({ backgroundImage: 'url(/parent-avatar.jpg)' })
    // The space's icon sits in a small badge in the corner
    const spaceIconBadge = screen.getByTestId('pinned-space-badge-space-id')
    expect(pinnedSpace).toContainElement(spaceIconBadge)
    expect(spaceIconBadge.parentElement).toHaveClass('absolute', '-bottom-1.5', '-right-1.5')
    expect(spaceIconBadge).toHaveClass('w-6', 'h-6')
    expect(spaceIconBadge.querySelector('svg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unpinned Space' })).not.toBeInTheDocument()

    // A space with its own avatar still shows the parent avatar full-frame, with the space avatar as the badge
    const customAvatarTile = screen.getByTestId('global-nav-space-custom-space-id')
    expect(customAvatarTile).toHaveStyle({ backgroundImage: 'url(/parent-avatar.jpg)' })
    expect(screen.getByTestId('pinned-space-avatar-custom-space-id').style.backgroundImage).toContain('space-avatar.jpg')

    // A space with neither icon nor avatar falls back to the default space glyph
    expect(screen.getByTestId('pinned-space-default-icon-no-icon-space-id')).toBeInTheDocument()

    fireEvent.click(pinnedSpace)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/groups/parent/spaces/space')
    })
  })

  it('selects only the pinned space, not its parent group, while the space is open', async () => {
    mockGlobalNavRequests()
    mockRouteParams = { context: 'groups', groupSlug: 'parent', spaceSlug: 'space' }
    try {
      render(
        <GlobalNav
          currentUser={{ id: '1', settings: { alreadySeenTour: true } }}
          routeParams={mockRouteParams}
        />,
        { wrapper: AllTheProviders(stateWithPinnedSpace(), ['/groups/parent/spaces/space']) }
      )

      const pinnedSpace = await screen.findByTestId('global-nav-space-space-id')
      expect(pinnedSpace).toHaveClass('border-selected')
      expect(screen.getByRole('button', { name: 'Parent' })).not.toHaveClass('border-selected')
      expect(screen.getByTestId('global-nav-space-custom-space-id')).not.toHaveClass('border-selected')
    } finally {
      mockRouteParams = {}
    }
  })
})
