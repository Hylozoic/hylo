import fetchGroupViews from './fetchGroupViews'

describe('fetchGroupViews', () => {
  it('loads the parent menu without nested space view lists', () => {
    const query = fetchGroupViews('1').graphql.query

    expect(query).toContain('groupViews(menuOnly: true)')
    // Space-row badges use membership.newPostCount, not nested chat views.
    expect(query).not.toMatch(/linkedGroup[\s\S]*groupViews[\s\S]*newPostCount/)
  })
})
