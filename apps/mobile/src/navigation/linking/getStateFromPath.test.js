import getStateFromPath from 'navigation/linking/getStateFromPath'

// Define test cases as [path, expectedScreenPath, optional expectedParams]
const testCases = [
  ['/login', 'NonAuthRoot/Login'],
  ['/reset-password', 'NonAuthRoot/ForgotPassword'],
  ['/signup', 'NonAuthRoot/Signup/Signup Intro'],
  ['/signup/verify-email', 'NonAuthRoot/Signup/SignupEmailValidation'],
  ['/groups/sample-group/join/xyz789', 'JoinGroup', { groupSlug: 'sample-group', accessCode: 'xyz789' }],
  ['/messages/123', 'AuthRoot/Drawer/Tabs/Messages Tab/Thread', { id: '123' }],
  ['/settings/account', 'AuthRoot/Drawer/Tabs/Settings Tab/Account'],
  ['/create/post', 'AuthRoot/Edit Post']
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

// Run tests
describe('getStateFromPath', () => {
  testCases.forEach(([path, expectedScreenPath, expectedParams]) => {
    test(`resolves ${path} to ${expectedScreenPath}${expectedParams ? ' with params' : ''}`, () => {
      const state = getStateFromPath(path)

      expect(state).not.toBeNull()
      expect(extractScreenPath(state)).toBe(expectedScreenPath)

      // Only assert params if expectedParams is provided
      if (expectedParams) {
        expect(state.routes?.[0]?.params || {}).toEqual(expectedParams)
      }
    })
  })
})
