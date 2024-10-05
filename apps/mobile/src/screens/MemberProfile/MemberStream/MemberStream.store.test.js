import { initialState } from './MemberStream.store'

describe('initialState', () => {
  it('is how it should be', () => {
    expect(initialState)
      .toEqual({
        choice: 'Posts'
      })
  })
})
