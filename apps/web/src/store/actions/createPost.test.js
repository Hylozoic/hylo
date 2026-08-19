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
    expect(action.graphql.variables.meetingLink).toEqual('https://zoom.us/j/123456789')
  })

  it('does not wait on chatActivityNotice in the create mutation', () => {
    const action = createPost({
      groups: [{ id: '1' }],
      details: '<p>hi</p>',
      type: 'chat'
    })

    expect(action.graphql.query).not.toMatch(/chatActivityNotice \{/)
    expect(action.meta.extractModel.modelName).toEqual('Post')
  })
})
