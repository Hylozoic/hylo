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
  ['/settings/account', 'AuthRoot/Drawer/Tabs/Settings Tab/Account'],
  ['/create/post', 'AuthRoot/Edit Post', { unmatchedBasePath: '' }],

  // When no Screen Path target yet defined, creates pending test cases
  ['/groups/rogue-scholars/discussions'],
  '/groups/rogue-scholars/discussions/post/22799',


  // Transcription of "notifications paths" from Web with sample data set:
  '/my/account',
  '/groups/rogue-scholars/join/abcdef',
  '/groups/rogue-scholars/settings/requests',
  '/groups/rogue-scholars',
  '/groups/rogue-scholars',
  '/groups/rogue-scholars/members/6789',
  '/groups/rogue-scholars/stream/post/12345',
  '/groups/rogue-scholars/post/12345',
  '/groups/rogue-scholars/discussions/post/12345',
  '/groups/rogue-scholars/events/post/12345',
  '/groups/rogue-scholars/projects/post/12345',
  '/groups/rogue-scholars/proposals/post/12345',
  '/groups/rogue-scholars/requests-and-offers/post/12345',
  '/groups/rogue-scholars/resources/post/12345',
  '/groups/rogue-scholars/chat/philosophy?postId=12345',
  '/groups/rogue-scholars/stream/post/12345',
  '/groups/rogue-scholars/events/post/12345',
  '/groups/rogue-scholars/stream/post/12345',
  '/groups/rogue-scholars/chat/philosophy/post/12345',
  '/groups/rogue-scholars/stream/post/12345?commentId=5555',
  '/groups/rogue-scholars/chat/philosophy/post/12345?commentId=5555',
  '/groups/rogue-scholars/stream/post/12345?commentId=5555',
  '/groups/rogue-scholars/chat/philosophy/post/12345?commentId=5555',
  '/messages/42076',
  '/groups/rogue-scholars/settings/relationships#parentInvites',
  '/groups/rogue-scholars',
  '/groups/rogue-scholars/settings/relationships#childRequests',
  '/groups/rogue-scholars/events/post/12345',
  '/groups/rogue-scholars/proposals/post/12345',
  '/groups/rogue-scholars/requests-and-offers/post/12345'
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
        const expectedParamsWithDefault = { ...expectedParams, originalLinkingPath: path, pathMatcher: finalRoute.params?.pathMatcher }
        expect(finalRoute.params || {}).toEqual(expectedParamsWithDefault)
      })
    } else {
      // Collect pending test results for snapshot comparison
      const state = getStateFromPath(path)
      pendingCases[path] = state
        ? {
            resolvedScreenPath: extractScreenPath(state),
            resolvedParams: getDeepestRoute(state.routes[0])?.params || {}
          }
        : null
    }
  })

  // Run a single test snapshot for all pending cases
  test('❌ PENDING TEST OUTPUT', () => {
    expect(pendingCases).toMatchSnapshot()
  })
})
