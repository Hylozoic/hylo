import afterInteractionsMiddleware from './afterInteractions'

describe('afterInteractionsMiddleware', () => {
  let next, middleware

  beforeEach(() => {
    middleware = afterInteractionsMiddleware({})
    next = jest.fn()
  })

  it('calls next with meta.afterInteractions', () => {
    return middleware(next)({ meta: { afterInteractions: true } })
      .then(() => expect(next).toHaveBeenCalled())
  })

  it('calls next without meta.afterInteractions', () => {
    middleware(next)({})
    expect(next).toHaveBeenCalled()
  })
})
