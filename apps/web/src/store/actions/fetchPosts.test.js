import fetchPosts from './fetchPosts'

it('works for a group', async () => {
  const posts = await fetchPosts({
    context: 'groups',
    id: 'foo',
    offset: 20,
    search: 'gardening',
    filter: 'offer'
  })
  expect(posts).toMatchSnapshot()
})

it('works for all groups', async () => {
  const posts = await fetchPosts({
    context: 'all',
    offset: 20,
    search: 'graphic design',
    filter: 'request'
  })
  expect(posts).toMatchSnapshot()
})

it('omits post groups for chat room queries', () => {
  const posts = fetchPosts({
    context: 'groups',
    filter: 'chat',
    includePostGroups: false,
    slug: 'foo'
  })
  expect(posts.graphql.query).not.toMatch(/\bgroups\s*\{/)
})
