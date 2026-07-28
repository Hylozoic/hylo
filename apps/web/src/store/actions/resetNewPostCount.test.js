import resetNewPostCount from './resetNewPostCount'

it('throws for non-Membership types', () => {
  expect(() => resetNewPostCount(5, 'TopicFollow')).toThrow(/bad type/)
})

it('works for Membership', () => {
  expect(resetNewPostCount(5, 'Membership')).toMatchSnapshot()
})
