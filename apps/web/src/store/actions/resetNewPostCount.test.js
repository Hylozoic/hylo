import resetNewPostCount from './resetNewPostCount'

it('throws an error for unknown type', () => {
  let caughtError
  try {
    resetNewPostCount(5, 'GroupTopic')
  } catch (error) {
    caughtError = error.message
  }
  expect(caughtError).toEqual('bad type for resetNewPostCount: GroupTopic')
})

it('works for Membership', () => {
  expect(resetNewPostCount(5, 'Membership')).toMatchSnapshot()
})

it('works for Membership', () => {
  expect(resetNewPostCount(5, 'TopicFollow')).toMatchSnapshot()
})
