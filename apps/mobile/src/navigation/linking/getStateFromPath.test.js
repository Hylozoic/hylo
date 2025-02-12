import getStateFromPath from 'navigation/linking/getStateFromPath'

// Define test cases as [path, expectedScreenPath, optional expectedParams]
// If a test case is just a string or an array with only one element, it is treated as a pending test.
const testCases = [
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

  // No Screen Path target yet defined, creates pending test cases
  ['/groups/rogue-scholars/discussions'],
  '/groups/rogue-scholars/discussions/post/22799'
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

// Run tests
describe('getStateFromPath (static & dynamic paths)', () => {
  testCases.forEach((testCase) => {
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
        const expectedParamsWithDefault = { ...expectedParams, originalLinkingPath: path }
        const finalRoute = getDeepestRoute(state.routes[0]) // Find the deepest route where params exist
        expect(finalRoute.params || {}).toEqual(expectedParamsWithDefault)
      })
    } else {
      // 🚨 Pending test case → Prints structured output without cluttering console
      test.failing(`❌ ${path} untested path match result`, (t) => {
        const state = getStateFromPath(path)
        const resolvedScreenPath = extractScreenPath(state)
        const resolvedParams = getDeepestRoute(state.routes[0])?.params || {}

        // Format structured output
        const formattedOutput = `${path}: ${resolvedScreenPath || '[null]'}\n` +
          `${JSON.stringify(resolvedParams, null, 2)}\n`

        console.info(formattedOutput)
        t.fail()
      })
    }
  })
})