import createPost from './createPost'

describe('createPost', () => {
  it('includes meetingLink in the GraphQL mutation and variables', () => {
    const action = createPost({
      groups: [{ id: '1' }],
      title: 'Online event',
      details: '<p></p>',
      type: 'event',
      meetingLink: 'https://zoom.us/j/123456789',
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      timezone: 'America/Los_Angeles'
    })

    expect(action.graphql.query).toMatch(/\$meetingLink:\s*String/)
    expect(action.graphql.query).toMatch(/meetingLink:\s*\$meetingLink/)
    expect(action.graphql.variables.meetingLink).to.equal('https://zoom.us/j/123456789')
  })
})
