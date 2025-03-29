import { fulfillPost } from './PostHeader.store'

describe('fulfillPost', () => {
  it('matches last snapshot', () => expect(fulfillPost(1)).toMatchSnapshot())
})
