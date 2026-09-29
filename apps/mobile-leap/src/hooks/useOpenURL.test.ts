/* eslint-env jest */
import { openURL, normalizeApexHost } from './useOpenURL'
import getStateFromPath from '../navigation/linking/getStateFromPath'

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn(async () => true),
    openURL: jest.fn(async () => true),
    addEventListener: jest.fn(() => ({ remove: jest.fn() }))
  }
}))

jest.mock('react-native-url-polyfill', () => ({ URL: global.URL }))

jest.mock('@react-navigation/native', () => ({
  CommonActions: { reset: jest.fn(state => ({ type: 'RESET', payload: state })) },
  StackActions: { replace: jest.fn((name, params) => ({ type: 'REPLACE', payload: { name, params } })) },
  getActionFromState: jest.fn(state => ({ type: 'NAVIGATE', payload: { name: state.routes[0].name, params: state.routes[0].params } })),
  useNavigation: jest.fn(),
  createNavigationContainerRef: jest.fn(() => ({ current: null }))
}))

jest.mock('../navigation/linking/getStateFromPath', () => jest.fn((path: string) => ({
  routes: [{ name: 'JoinGroup', params: { path } }]
})))

jest.mock('../navigation/linking/getInitialURL', () => jest.fn())

const { Linking } = jest.requireMock('react-native')

function fakeNavigation () {
  return { dispatch: jest.fn() }
}

describe('openURL with hylo.com links (no www)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('routes a join link inside the app', async () => {
    const navigation = fakeNavigation()
    await openURL('https://hylo.com/groups/x/join/y', {}, navigation as any)
    expect(getStateFromPath).toHaveBeenCalledWith('/groups/x/join/y')
    expect(navigation.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'NAVIGATE' }))
    expect(Linking.openURL).not.toHaveBeenCalled()
  })

  it('routes an invitation link inside the app, keeping its token', async () => {
    const navigation = fakeNavigation()
    await openURL('https://hylo.com/h/use-invitation?token=abc123', {}, navigation as any)
    expect(getStateFromPath).toHaveBeenCalledWith('/h/use-invitation?token=abc123')
    expect(navigation.dispatch).toHaveBeenCalled()
    expect(Linking.openURL).not.toHaveBeenCalled()
  })

  it('routes www links the same way as before', async () => {
    const navigation = fakeNavigation()
    await openURL('https://www.hylo.com/groups/x/join/y', {}, navigation as any)
    expect(getStateFromPath).toHaveBeenCalledWith('/groups/x/join/y')
    expect(navigation.dispatch).toHaveBeenCalled()
  })

  it('still sends hylo.com OAuth pages to the system browser', async () => {
    const navigation = fakeNavigation()
    await openURL('https://hylo.com/oauth/consent/123', {}, navigation as any)
    expect(navigation.dispatch).not.toHaveBeenCalled()
    expect(Linking.openURL).toHaveBeenCalled()
  })

  it('opens other sites outside the app', async () => {
    const navigation = fakeNavigation()
    await openURL('https://hylo.com.example.org/groups/x', {}, navigation as any)
    expect(navigation.dispatch).not.toHaveBeenCalled()
    expect(Linking.openURL).toHaveBeenCalledWith('https://hylo.com.example.org/groups/x')
  })
})

describe('normalizeApexHost', () => {
  it('rewrites only the hylo.com host', () => {
    expect(normalizeApexHost('https://hylo.com')).toBe('https://www.hylo.com')
    expect(normalizeApexHost('https://hylo.com/groups/x')).toBe('https://www.hylo.com/groups/x')
    expect(normalizeApexHost('https://hylo.com?x=1')).toBe('https://www.hylo.com?x=1')
    expect(normalizeApexHost('https://www.hylo.com/a')).toBe('https://www.hylo.com/a')
    expect(normalizeApexHost('https://hylo.community/a')).toBe('https://hylo.community/a')
    expect(normalizeApexHost('/groups/x')).toBe('/groups/x')
  })
})
