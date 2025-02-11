import getStateFromPath, {
  getRouteMatchForPath,
  addParamsToScreenPath,
  buildScreenConfigFromScreenPath
} from 'navigation/linking/getStateFromPath'
import { routingConfig, DEFAULT_APP_HOST } from 'navigation/linking/config'

jest.mock("query-string" , () => ({
  __esModule: true,
  default: {
      parse :jest.fn(),
      stringify: jest.fn()
  }
}))

/**
 * Define test cases separately for better maintainability
 */
const testCases = {
  '/login': 'NonAuthRoot/Login',
  '/reset-password': 'NonAuthRoot/ForgotPassword',
  '/signup': 'NonAuthRoot/Signup/Signup Intro',
  '/signup/verify-email': 'NonAuthRoot/Signup/SignupEmailValidation',
  '/noo/login/jwt': 'LoginByTokenHandler',
  '/h/use-invitation': 'JoinGroup',
  '/groups/some-group/join/12345': 'JoinGroup',
  '/hylo-editor': 'AuthRoot/HyloEditor',
  '/all/post/5678': 'AuthRoot/Drawer/Tabs/Home Tab/Post Details',
  '/groups/some-group/post/5678/edit': 'AuthRoot/Edit Post',
  '/settings/account': 'AuthRoot/Drawer/Tabs/Settings Tab/Account',
  '/messages/123': 'AuthRoot/Drawer/Tabs/Messages Tab/Thread',
  '/create/post': 'AuthRoot/Edit Post',
  '/': 'AuthRoot/Drawer/Tabs/Home Tab/Stream'
}

describe('getStateFromPath', () => {
  Object.entries(testCases).forEach(([path, expectedScreenPath]) => {
    test(`resolves ${path} to ${expectedScreenPath}`, () => {
      const state = getStateFromPath(path)
      expect(state).not.toBeNull()

      // Extract the final resolved screen path from the state object
      const resolvedScreenPath = extractScreenPath(state)
      expect(resolvedScreenPath).toBe(expectedScreenPath)
    })
  })
})

describe('getRouteMatchForPath', () => {
  test('correctly matches static and dynamic paths', () => {
    const match1 = getRouteMatchForPath('/login')
    expect(match1).toHaveProperty('screenPath', 'NonAuthRoot/Login')

    const match2 = getRouteMatchForPath('/groups/some-group/join/12345')
    expect(match2).toHaveProperty('screenPath', 'JoinGroup')

    const match3 = getRouteMatchForPath('/hylo-editor')
    expect(match3).toHaveProperty('screenPath', 'AuthRoot/HyloEditor')

    const match4 = getRouteMatchForPath('/nonexistent-path')
    expect(match4).toBeUndefined() // Should return `undefined` for 404 cases
  })
})

describe('addParamsToScreenPath', () => {
  test('correctly appends query parameters to path', () => {
    const routeMatch = getRouteMatchForPath('/groups/some-group/join/12345')
    const { screenPath, path } = addParamsToScreenPath(routeMatch)

    expect(screenPath).toBe('JoinGroup')
    expect(path).toContain('originalLinkingPath=')
  })

  test('handles URLs with query params correctly', () => {
    const routeMatch = getRouteMatchForPath('/settings/account?theme=dark')
    const { path } = addParamsToScreenPath(routeMatch)

    expect(path).toContain('theme=dark')
    expect(path).toContain('originalLinkingPath=')
  })
})

describe('buildScreenConfigFromScreenPath', () => {
  test('correctly builds screen config for simple paths', () => {
    const screenConfig = buildScreenConfigFromScreenPath('NonAuthRoot/Login')
    expect(screenConfig).toEqual({
      screens: {
        NonAuthRoot: {
          screens: {
            Login: '*'
          }
        }
      }
    })
  })

  test('correctly builds nested screen configs', () => {
    const screenConfig = buildScreenConfigFromScreenPath('AuthRoot/Drawer/Tabs/Home Tab/Post Details')
    expect(screenConfig).toEqual({
      screens: {
        AuthRoot: {
          screens: {
            Drawer: {
              screens: {
                Tabs: {
                  screens: {
                    'Home Tab': {
                      screens: {
                        'Post Details': '*'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  })
})

/**
 * Helper function to extract the final screen path from a state object.
 * Assumes `state` follows the structure `{ routes: [{ name: 'SomeScreen', state: { routes: [...] } }] }`
 */
const extractScreenPath = (state) => {
  const pathParts = []
  let currentState = state

  while (currentState && currentState.routes) {
    const { name, state: nestedState } = currentState.routes[0]
    pathParts.push(name)
    currentState = nestedState
  }

  return pathParts.join('/')
}
