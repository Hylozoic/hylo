import fetchPosts from './fetchPosts'

it('sets updateLastViewed to true when fetching for a group', () => {
  expect(fetchPosts({ context: 'groups', slug: 'anything' })).toMatchSnapshot()
})
