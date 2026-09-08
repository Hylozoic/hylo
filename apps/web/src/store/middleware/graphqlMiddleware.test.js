import graphqlMiddleware from 'store/middleware/graphqlMiddleware'

it('adds a `then` that rejects when there are errors', async () => {
  const action = {
    type: 'FOO',
    graphql: true,
    payload: {
      errors: [{ message: 'problems' }]
    }
  }
  const next = jest.fn(async val => val)
  const { meta } = await graphqlMiddleware({})(next)(action)

  expect(next).toHaveBeenCalled()

  let caughtError

  try {
    await meta.then(action.payload)
  } catch (error) {
    caughtError = error
  }

  expect(caughtError).toBeInstanceOf(Error)
  expect(caughtError.message).toEqual('problems')
})

it('passes through when there are field errors but `data` is present', async () => {
  const action = {
    type: 'FOO',
    graphql: true,
    payload: {
      data: { group: { id: '1', name: 'Keep me' } },
      errors: [{ message: 'widgets failed' }]
    }
  }
  const next = jest.fn(async val => val)
  const { meta } = await graphqlMiddleware({})(next)(action)
  const payload = await meta.then(action.payload)

  expect(payload.getData()).toEqual({ id: '1', name: 'Keep me' })
})

it('adds a `then` that passes through `payload` when there are no errors', async () => {
  const action = {
    type: 'FOO',
    graphql: true,
    payload: {
      data: 'no problems'
    }
  }
  const next = jest.fn(async val => val)
  const { meta } = await graphqlMiddleware({})(next)(action)

  expect(next).toHaveBeenCalled()

  let caughtError

  try {
    await meta.then(action.payload)
  } catch (error) {
    caughtError = error
  }

  expect(caughtError).toEqual(undefined)
})

it('`meta.then` continuation - runs when there are no errors', async () => {
  const providedThen = jest.fn(async () => true)
  const action = {
    type: 'FOO',
    graphql: true,
    meta: {
      then: providedThen
    },
    payload: {
      data: 'no problems'
    }
  }
  const next = jest.fn(async val => val)
  const { meta } = await graphqlMiddleware({})(next)(action)
  await meta.then(action.payload)

  expect(providedThen).toHaveBeenCalled()
})

it('`payload.getData()` - can get data under root of graphql under operation name', async () => {
  const action = {
    type: 'FOO',
    graphql: true,
    payload: {
      data: {
        myGraphqlOperationName: 'no problems'
      }
    }
  }
  const next = jest.fn(async val => val)
  const { meta } = await graphqlMiddleware({})(next)(action)
  const payload = await meta.then(action.payload)

  expect(payload.getData()).toEqual('no problems')
})
