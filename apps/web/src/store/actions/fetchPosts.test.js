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
    context: 'my',
    offset: 20,
    search: 'graphic design',
    filter: 'request'
  })
  expect(posts).toMatchSnapshot()
})
