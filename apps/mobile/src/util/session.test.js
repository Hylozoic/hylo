import { parseCookies, sessionFromTokenUrl, joinWebBaseAndPath, normalizeWebPath } from './session'

jest.mock('react-native-config', () => ({
  HYLO_WEB_BASE_URL: 'https://review-app.herokuapp.com',
  API_HOST: 'https://api-staging.hylo.com',
  SESSION_COOKIE_KEY: 'hylo.staging.sid2'
}))

jest.mock('util/apiHost', () => 'https://api-staging.hylo.com')

it('sessionFromTokenUrl uses review web proxy for non-hylo.com hosts', () => {
  expect(sessionFromTokenUrl()).toBe(
    'https://review-app.herokuapp.com/noo/session/from-token'
  )
})

it('joinWebBaseAndPath avoids double slashes', () => {
  expect(joinWebBaseAndPath('https://review-app.herokuapp.com/', '/app')).toBe(
    'https://review-app.herokuapp.com/app'
  )
})

it('normalizeWebPath collapses leading slashes', () => {
  expect(normalizeWebPath('//app')).toBe('/app')
})

const testString = 'heroku-session-affinity=AECDaANoA24IARbTS53///8_; ' +
  'Version=1; Expires=Fri, 28-Jul-2017 18:20:27 GMT; Max-Age=86400; ' +
  'Domain=node1.hylo.com; Path=/, hylo.sid.1=s%3AvIVEtOta7AMVJyF5PzJ7r6.f7; ' +
  'Domain=.hylo.com; Path=/; Expires=Mon, 25 Sep 2017 18:20:27 GMT; HttpOnly'

it('handles a broken multiple-cookie format', () => {
  expect(parseCookies(testString)).toEqual({
    Domain: '.hylo.com',
    Expires: 'Mon, 25 Sep 2017 18:20:27 GMT',
    HttpOnly: 'undefined',
    'Max-Age': '86400',
    Path: '/',
    Version: '1',
    'heroku-session-affinity': 'AECDaANoA24IARbTS53///8_',
    'hylo.sid.1': 's:vIVEtOta7AMVJyF5PzJ7r6.f7'
  })
})
