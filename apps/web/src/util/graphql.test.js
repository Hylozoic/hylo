import { runGraphql } from './graphql'

describe('runGraphql', () => {
  const action = { type: 'FETCH_THING' }

  it('returns the requested field of the response data', async () => {
    const dispatch = jest.fn().mockResolvedValue({ payload: { data: { thing: { id: '1' } } } })
    await expect(runGraphql(dispatch, action, 'thing')).resolves.toEqual({ id: '1' })
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('returns undefined when the response has no such field', async () => {
    const dispatch = jest.fn().mockResolvedValue({ payload: { data: {} } })
    await expect(runGraphql(dispatch, action, 'thing')).resolves.toBeUndefined()
  })

  it('throws the payload of a resolved error', async () => {
    const error = new Error('Not allowed')
    const dispatch = jest.fn().mockResolvedValue({ error: true, payload: error })
    await expect(runGraphql(dispatch, action, 'thing')).rejects.toBe(error)
  })

  it('throws a generic error when a resolved error has no payload', async () => {
    const dispatch = jest.fn().mockResolvedValue({ error: true })
    await expect(runGraphql(dispatch, action, 'thing')).rejects.toThrow('GraphQL error')
  })

  it('passes a rejection through', async () => {
    const error = new Error('Network down')
    const dispatch = jest.fn().mockRejectedValue(error)
    await expect(runGraphql(dispatch, action, 'thing')).rejects.toBe(error)
  })
})
