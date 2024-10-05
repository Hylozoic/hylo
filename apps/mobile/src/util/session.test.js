import { parseCookies } from './session'

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
