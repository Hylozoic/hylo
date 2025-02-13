import getStateFromPath from 'navigation/linking/getStateFromPath'

// // Transcription of "notifications paths" from Web
// '/my/account',
// '/groups/:groupSlug/join/:accessCode',
// '/groups/:groupSlug/settings/requests',
// '/groups/:groupSlug',
// '/groups/:groupSlug',
// '/groups/:groupSlug/members/:personId',
// '/groups/:groupSlug/stream/post/:postId',
// '/groups/:groupSlug/post/:postId',
// '/groups/:groupSlug/discussions/post/:postId',
// '/groups/:groupSlug/events/post/:postId',
// '/groups/:groupSlug/projects/post/:postId',
// '/groups/:groupSlug/proposals/post/:postId',
// '/groups/:groupSlug/requests-and-offers/post/:postId',
// '/groups/:groupSlug/resources/post/:postId',
// '/groups/:groupSlug/chat/:topicName?postId=:postId',
// '/groups/:groupSlug/stream/post/:postId',
// '/groups/:groupSlug/events/post/:postId',
// '/groups/:groupSlug/stream/post/:postId',
// '/groups/:groupSlug/chat/:topicName/post/:postId',
// '/groups/:groupSlug/stream/post/:postId?commentId=:commentId',
// '/groups/:groupSlug/chat/:topicName/post/:postId?commentId=:commentId',
// '/groups/:groupSlug/stream/post/:postId?commentId=:commentId',
// '/groups/:groupSlug/chat/:topicName/post/:postId?commentId=:commentId',
// '/messages/42076',
// '/groups/:groupSlug/settings/relationships#parentInvites',
// '/groups/:groupSlug',
// '/groups/:groupSlug/settings/relationships#childRequests',
// '/groups/:groupSlug/events/post/:postId',
// '/groups/:groupSlug/proposals/post/:postId',
// '/groups/:groupSlug/requests-and-offers/post/:postId'

// Define test cases as [path, expectedScreenPath, optional expectedParams]
// If a test case is just a string or an array with only one element, it is treated as a pending test.
const notificationsSamplePaths = [
  // Original sample sorta hodge-podge test set:
  ['/login', 'NonAuthRoot/Login'],
  ['/reset-password', 'NonAuthRoot/ForgotPassword'],
  ['/signup', 'NonAuthRoot/Signup/Signup Intro'],
  ['/signup/verify-email', 'NonAuthRoot/Signup/SignupEmailValidation', { step: 'verify-email' }],
  [
    '/groups/sample-group/join/xyz789', 'JoinGroup', {
      groupSlug: 'sample-group', accessCode: 'xyz789', context: 'groups', originalLinkingPath: '/groups/sample-group/join/xyz789'
    }
  ],
  ['/messages/123', 'AuthRoot/Drawer/Tabs/Messages Tab/Thread', { id: '123' }],
  ['/my/account', 'AuthRoot/Drawer/Tabs/Settings Tab', { context: 'my', settingsArea: 'account' }],
  ['/create/post', 'AuthRoot/Edit Post', { unmatchedBasePath: '' }],

  // When no Screen Path target yet defined, creates pending test cases
  ['/groups/rogue-scholars/discussions'],
  '/groups/rogue-scholars/discussions/post/22799',

  // Transcription of sample data from Hylo Routing Google Sheet
  '/all/discussions',
  '/all/events',
  '/all/map',
  '/all/members/123',
  '/all/projects',
  '/all/proposals',
  '/all/requests-and-offers',
  '/all/resources',
  '/all/stream',
  '/all/topics/sustainability',
  '/create-group',
  '/group/example-group/moderation',
  '/groups/example-group',
  '/groups/example-group/about',
  '/groups/example-group/all-views',
  '/groups/example-group/chat/general',
  '/groups/example-group/custom/42',
  '/groups/example-group/discussions',
  '/groups/example-group/events',
  '/groups/example-group/groups',
  '/groups/example-group/join/abc123',
  '/groups/example-group/map',
  '/groups/example-group/members/456',
  '/groups/example-group/post/789',
  '/groups/example-group/projects',
  '/groups/example-group/proposals',
  '/groups/example-group/requests-and-offers',
  '/groups/example-group/resources',
  '/groups/example-group/settings',
  '/groups/example-group/settings/agreements',
  '/groups/example-group/settings/delete',
  '/groups/example-group/settings/export',
  '/groups/example-group/settings/import',
  '/groups/example-group/settings/invite',
  '/groups/example-group/settings/privacy',
  '/groups/example-group/settings/relationships',
  '/groups/example-group/settings/requests',
  '/groups/example-group/settings/responsibilities',
  '/groups/example-group/settings/roles',
  '/groups/example-group/settings/topics',
  '/groups/example-group/settings/views',
  '/groups/example-group/stream',
  '/groups/example-group/topics/technology',
  '/h/use-invitation',
  '/login',
  '/members/789',
  '/messages/321',
  '/my/account',
  '/my/announcements',
  '/my/discussions',
  '/my/edit-profile',
  '/my/events',
  '/my/groups',
  '/my/interactions',
  '/my/invitations',
  '/my/locale',
  '/my/mentions',
  '/my/notifications',
  '/my/posts',
  '/my/projects',
  '/my/proposals',
  '/my/requests-and-offers',
  '/my/resources',
  '/my/saved-searches',
  '/notifications',
  '/oauth/consent/xyz789',
  '/oauth/login/xyz789',
  '/post/555',
  '/public',
  '/public/discussions',
  '/public/events',
  '/public/groups',
  '/public/map',
  '/public/projects',
  '/public/proposals',
  '/public/requests-and-offers',
  '/public/resources',
  '/public/stream',
  '/public/topics/climate-change',
  '/reset-password',
  '/search',
  '/signup',
  '/signup/finish',
  '/signup/verify-email',
  '/welcome'
]

// Extracts the resolved screen path from the returned navigation state
const extractScreenPath = (state) => {
  const pathParts = []
  let currentState = state

  while (currentState?.routes) {
    const { name, state: nestedState } = currentState.routes[0]
    pathParts.push(name)
    currentState = nestedState
  }

  return pathParts.join('/')
}

// Extracts the deepest route where params should exist
const getDeepestRoute = (route) => {
  while (route.state && route.state.routes) {
    route = route.state.routes[0] // Dive deeper
  }
  return route
}

describe('getStateFromPath', () => {
  const pendingCases = {}

  notificationsSamplePaths.forEach((testCase) => {
    // Normalize test cases
    const path = Array.isArray(testCase) ? testCase[0] : testCase
    const expectedScreenPath = Array.isArray(testCase) && testCase.length > 1 ? testCase[1] : null
    const expectedParams = Array.isArray(testCase) && testCase.length > 2 ? testCase[2] : null

    if (expectedScreenPath) {
      // ✅ Regular test case
      test(`${path} => "${expectedScreenPath}"${expectedParams ? ' with params' : ''}`, () => {
        const state = getStateFromPath(path)

        expect(state).not.toBeNull()
        expect(extractScreenPath(state)).toBe(expectedScreenPath)

        // Only assert params if expectedParams is provided
        const finalRoute = getDeepestRoute(state.routes[0]) // Find the deepest route where params exist
        if (expectedParams) {
          const expectedParamsWithDefault = { ...expectedParams, originalLinkingPath: path, pathMatcher: finalRoute.params?.pathMatcher }
          expect(finalRoute.params || {}).toEqual(expectedParamsWithDefault)
        }
      })
    } else {
      // Collect pending test results for snapshot comparison
      const state = getStateFromPath(path)
      pendingCases[path] = state
        ? {
            path: extractScreenPath(state),
            routeParams: getDeepestRoute(state.routes[0])?.params || {}
          }
        : null
    }
  })

  // Run a single test snapshot for all pending cases
  test('❌ Snapshot test path resolutions (for paths without expectations)', () => {
    expect(pendingCases).toMatchSnapshot()
  })
})
