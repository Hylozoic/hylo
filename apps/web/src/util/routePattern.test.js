import routePattern, { GENERIC_ROUTE } from './routePattern'

describe('routePattern', () => {
  it.each([
    ['/', '/'],
    ['/groups/garden-club/stream', '/groups/:groupSlug/stream'],
    ['/groups/garden-club/all', '/groups/:groupSlug/all'],
    ['/groups/garden-club/post/123', '/groups/:groupSlug/post/:postId'],
    ['/groups/garden-club/post/123/comments/456', '/groups/:groupSlug/post/:postId/comments/:commentId'],
    ['/groups/garden-club/spaces/kitchen/chat/general', '/groups/:groupSlug/spaces/:spaceSlug/chat/:topicName'],
    ['/groups/garden-club/spaces/kitchen/events', '/groups/:groupSlug/spaces/:spaceSlug/events'],
    ['/groups/garden-club/topics/seed-swap', '/groups/:groupSlug/topics/:topicName'],
    ['/groups/garden-club/custom/88', '/groups/:groupSlug/custom/:viewId'],
    ['/groups/garden-club/members/42', '/groups/:groupSlug/members/:personId'],
    ['/groups/garden-club/members/create', '/groups/:groupSlug/members/create'],
    ['/groups/garden-club/settings/roles', '/groups/:groupSlug/settings/roles'],
    ['/groups/garden-club/about/related-groups', '/groups/:groupSlug/about/related-groups'],
    ['/groups/garden-club/offerings/7', '/groups/:groupSlug/offerings/:offeringId'],
    ['/post/99', '/post/:postId'],
    ['/members/42', '/members/:personId'],
    ['/messages/1234', '/messages/:messageThreadId'],
    ['/my/notifications', '/my/notifications'],
    ['/all/map/group/some-group', '/all/map/group/:groupSlug'],
    ['/public/groups', '/public/groups'],
    ['/oauth/login/Xy12AbC', '/oauth/login/:uid'],
    ['/login', '/login'],
    ['/signup/verify-email', '/signup/verify-email'],
    ['/welcome/recommended-groups', '/welcome/recommended-groups'],
    ['/management/groups/without-administrator', '/management/groups/without-administrator'],
    ['/management/groups/deleted', '/management/groups/deleted'],
    ['/management/site/new-public-groups', '/management/site/new-public-groups'],
    ['/management/safety/reports', '/management/safety/reports']
  ])('%s → %s', (pathname, expected) => {
    expect(routePattern(pathname)).toBe(expected)
  })

  it('replaces the access code in a join link', () => {
    expect(routePattern('/groups/garden-club/join/Zq81xYtoken')).toBe('/groups/:groupSlug/join/:accessCode')
  })

  it('drops the query string and hash, so invitation tokens never appear', () => {
    expect(routePattern('/h/use-invitation?token=abc123&email=ada%40example.com')).toBe('/h/use-invitation')
    expect(routePattern('/h/invitation?token=abc123')).toBe('/h/invitation')
    expect(routePattern('/groups/garden-club/stream?search=secret#top')).toBe('/groups/:groupSlug/stream')
  })

  it('treats a slug that looks like a page name as a slug', () => {
    expect(routePattern('/groups/post/stream')).toBe('/groups/:groupSlug/stream')
    expect(routePattern('/groups/map/topics/events')).toBe('/groups/:groupSlug/topics/:topicName')
  })

  it('replaces any segment it does not know', () => {
    expect(routePattern('/groups/garden-club/something-new')).toBe('/groups/:groupSlug/:id')
    expect(routePattern('/my/Ada Lovelace')).toBe('/my/:id')
  })

  it('reports addresses outside the app with the generic pattern', () => {
    expect(routePattern('/garden-club')).toBe(GENERIC_ROUTE)
    expect(routePattern('/wp-admin/setup.php')).toBe(GENERIC_ROUTE)
    expect(routePattern(undefined)).toBe(GENERIC_ROUTE)
  })

  it('caps very long addresses', () => {
    expect(routePattern('/groups/a/b/c/d/e/f/g/h/i/j')).toBe('/groups/:groupSlug/:id/:id/:id/:id/:id/:id/*')
  })
})
