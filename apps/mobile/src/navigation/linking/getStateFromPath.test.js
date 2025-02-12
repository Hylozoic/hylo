import getStateFromPath from 'navigation/linking/getStateFromPath'
import { routingConfig } from 'navigation/linking'

/**
 * Sample values to replace dynamic route parameters.
 */
const sampleData = {
  ':groupSlug': 'sample-group',
  ':id': '123',
  ':commentId': '456',
  ':accessCode': 'xyz789',
  ':topicName': 'community',
  ':customViewId': '42',
  '(.*)': 'random-path'
}

/**
 * Generate dynamic test cases by replacing placeholders in routingConfig.
 */
const generateDynamicTestCases = (routingConfig) => {
  return Object.entries(routingConfig)
    .filter(([path]) => path.includes(':') || path.includes('(.*)')) // Only keep dynamic paths
    .reduce((cases, [path, screenPath]) => {
      let dynamicPath = path

      // Replace each placeholder with sample data
      Object.entries(sampleData).forEach(([param, value]) => {
        dynamicPath = dynamicPath.replace(param, value)
      })

      // Add a query string variation
      cases[dynamicPath] = screenPath
      cases[`${dynamicPath}?utm_source=test&ref=abc123`] = screenPath

      return cases
    }, {})
}

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

// Generate test cases
const dynamicTestCases = generateDynamicTestCases(routingConfig)

/**
 * Jest test suite for dynamic paths.
 */
describe('getStateFromPath (dynamic paths)', () => {
  Object.entries(dynamicTestCases).forEach(([path, expectedScreenPath]) => {
    test(`resolves ${path} to ${expectedScreenPath}`, () => {
      const state = getStateFromPath(path)
      expect(state).not.toBeNull()

      const resolvedScreenPath = extractScreenPath(state)
      expect(resolvedScreenPath).toBe(expectedScreenPath)
    })
  })
})
