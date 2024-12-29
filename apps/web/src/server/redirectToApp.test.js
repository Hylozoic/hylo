import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import redirectToApp from './redirectToApp'

it('just calls next() if the url is not /', async () => {
  const req = {
    url: '/foo',
    cookies: { [process.env.HYLO_COOKIE_NAME]: 'yeah' }
  }
  const res = { redirect: jest.fn() }
  const next = jest.fn()

  await redirectToApp(req, res, next)

  expect(next).toBeCalled()
  expect(res.redirect).not.toBeCalled()
})

it('just calls next() if there is no matching cookie', async () => {
  const req = {
    url: '/',
    cookies: {}
  }
  const res = { redirect: jest.fn() }
  const next = jest.fn()

  await redirectToApp(req, res, next)

  expect(next).toBeCalled()
  expect(res.redirect).not.toBeCalled()
})

it('just calls next() if user is not logged in', async () => {
  const req = {
    url: '/',
    cookies: { [process.env.HYLO_COOKIE_NAME]: 'yeah' },
    headers: { cookie: 'yeah' }
  }
  const res = { redirect: jest.fn() }
  const next = jest.fn()

  mockGraphqlServer.use(
    graphql.query('CheckLogin', () => {
      return HttpResponse.json({
        data: {
          checkLogin: {
            me: null
          }
        }
      })
    })
  )

  await redirectToApp(req, res, next)

  expect(next).toBeCalled()
  expect(res.redirect).not.toBeCalled()
})

it('redirects to /app when user is logged in', async () => {
  const req = {
    url: '/',
    cookies: { [process.env.HYLO_COOKIE_NAME]: 'yeah' },
    headers: { cookie: 'yeah' }
  }
  const res = { redirect: jest.fn() }
  const next = jest.fn()

  mockGraphqlServer.use(
    graphql.query('CheckLogin', () => {
      return HttpResponse.json({
        data: {
          me: {
            id: '1'
          }
        }
      })
    })
  )

  await redirectToApp(req, res, next)

  expect(next).not.toBeCalled()
  expect(res.redirect).toBeCalledWith('/app?rd=1')
})
