import validatePostData, { groupAcceptsPostType, assertGroupsAcceptPostType, destinationLabel, POST_TYPE_NOT_ACCEPTED } from './validatePostData'

describe('validatePostData', () => {
  var user, inGroup, notInGroup

  before(function () {
    inGroup = new Group({ slug: 'foo', name: 'Foo' })
    notInGroup = new Group({ slug: 'bar', name: 'Bar' })
    user = new User({name: 'Cat', email: 'a@b.c'})
    return Promise.join(
      inGroup.save(),
      notInGroup.save(),
      user.save()
    ).then(function () {
      return user.joinGroup(inGroup)
    })
  })

  it('fails if an invalid type is provided', () => {
    const fn = () => validatePostData(null, {name: 't', type: 'thread'})
    expect(fn).to.throw(/not a valid type/)
  })

  it('fails if no group_ids are provided', () => {
    const fn = () => validatePostData(null, {name: 't'})
    expect(fn).to.throw(/no groups specified/)
  })

  it('fails if there is a group_id for a group user is not a member of', () => {
    const data = {name: 't', group_ids: [inGroup.id, notInGroup.id]}
    return validatePostData(user.id, data)
    .catch(function (e) {
      expect(e.message).to.match(/unable to post to all those groups/)
    })
  })

  it('fails if there are more than 3 topicNames', () => {
    const fn = () => validatePostData(null, {
      name: 't',
      group_ids: [inGroup.id],
      topicNames: ['la', 'ra', 'bar', 'far']})
    expect(fn).to.throw(/too many topics in post, maximum 3/)
  })

  it('continues the promise chain if name is provided and user is member of groups', () => {
    const data = {name: 't', group_ids: [inGroup.id]}
    return validatePostData(user.id, data)
    .catch(() => expect.fail('should resolve'))
  })

  it('continues the promise chain if valid type is provided', () => {
    const data = {name: 't', type: Post.Type.PROJECT, group_ids: [inGroup.id]}
    return validatePostData(user.id, data)
    .catch(() => expect.fail('should resolve'))
  })
})

describe('groupAcceptsPostType', () => {
  it('allows all types when accepted_post_types is null', () => {
    expect(groupAcceptsPostType(null, 'discussion')).to.equal(true)
    expect(groupAcceptsPostType(undefined, 'event')).to.equal(true)
  })

  it('rejects restricted types when accepted_post_types is empty', () => {
    expect(groupAcceptsPostType([], 'discussion')).to.equal(false)
    expect(groupAcceptsPostType([], 'event')).to.equal(false)
  })

  it('allows chat, action, and submission even when accepted_post_types is empty', () => {
    expect(groupAcceptsPostType([], 'chat')).to.equal(true)
    expect(groupAcceptsPostType([], 'action')).to.equal(true)
    expect(groupAcceptsPostType([], 'submission')).to.equal(true)
  })

  it('allows only the listed types', () => {
    expect(groupAcceptsPostType(['discussion'], 'discussion')).to.equal(true)
    expect(groupAcceptsPostType(['discussion'], 'event')).to.equal(false)
    expect(groupAcceptsPostType(['request', 'offer'], 'request')).to.equal(true)
    expect(groupAcceptsPostType(['request', 'offer'], 'discussion')).to.equal(false)
  })

  it('parses jsonb strings', () => {
    expect(groupAcceptsPostType('["discussion"]', 'discussion')).to.equal(true)
    expect(groupAcceptsPostType('["discussion"]', 'event')).to.equal(false)
  })

  it('treats requests-and-offers as an alias for request and offer', () => {
    expect(groupAcceptsPostType(['requests-and-offers'], 'request')).to.equal(true)
    expect(groupAcceptsPostType(['requests-and-offers'], 'offer')).to.equal(true)
    expect(groupAcceptsPostType(['requests-and-offers'], 'discussion')).to.equal(false)
  })
})

describe('assertGroupsAcceptPostType', () => {
  let openGroup, discussionOnly, noneAccepted, parentGroup, chatSpace, openSpace, eventsSpace

  before(async function () {
    openGroup = new Group({ slug: 'apt-open', name: 'Open Group' })
    discussionOnly = new Group({ slug: 'apt-discussion', name: 'Discussion Only', accepted_post_types: ['discussion'] })
    noneAccepted = new Group({ slug: 'apt-none', name: 'None Accepted', accepted_post_types: [] })
    parentGroup = new Group({ slug: 'apt-parent', name: 'Hylo Stewards' })
    await Promise.all([openGroup.save(), discussionOnly.save(), noneAccepted.save(), parentGroup.save()])
    chatSpace = new Group({ slug: 'apt-chat-space', name: 'partnerships', type: 'space', parent_id: parentGroup.id, accepted_post_types: ['chat'] })
    openSpace = new Group({ slug: 'apt-open-space', name: 'general', type: 'space', parent_id: parentGroup.id })
    eventsSpace = new Group({ slug: 'apt-events-space', name: 'gatherings', type: 'space', parent_id: parentGroup.id, accepted_post_types: ['event'] })
    await Promise.all([chatSpace.save(), openSpace.save(), eventsSpace.save()])
  })

  const rejectionMessage = (groupIds, postType) =>
    assertGroupsAcceptPostType(groupIds, postType)
      .then(() => expect.fail('should reject'), e => e.message)

  it('allows a restricted type when accepted_post_types is null', () => {
    return assertGroupsAcceptPostType([openGroup.id], Post.Type.EVENT)
  })

  it('rejects a type the group does not accept', async () => {
    expect(await rejectionMessage([discussionOnly.id], Post.Type.EVENT))
      .to.equal('Discussion Only does not accept event posts')
  })

  it('rejects a restricted type when accepted_post_types is empty', async () => {
    expect(await rejectionMessage([noneAccepted.id], Post.Type.DISCUSSION))
      .to.equal('None Accepted does not accept discussion posts')
  })

  it('allows chat when accepted_post_types is empty', () => {
    return assertGroupsAcceptPostType([noneAccepted.id], Post.Type.CHAT)
  })

  it('names only the destination that refuses the type', async () => {
    expect(await rejectionMessage([openGroup.id, discussionOnly.id], Post.Type.EVENT))
      .to.equal('Discussion Only does not accept event posts')
  })

  it('labels a space with its parent group', async () => {
    expect(await rejectionMessage([parentGroup.id, openSpace.id, chatSpace.id], Post.Type.DISCUSSION))
      .to.equal('Hylo Stewards / partnerships does not accept discussion posts')
  })

  it('lists every blocking destination, in the order given, and no others', async () => {
    const message = await rejectionMessage([chatSpace.id, openGroup.id, discussionOnly.id, openSpace.id], Post.Type.EVENT)
    expect(message).to.equal('Hylo Stewards / partnerships and Discussion Only do not accept event posts')
  })

  it('joins three or more blockers with commas', async () => {
    const message = await rejectionMessage([eventsSpace.id, chatSpace.id, noneAccepted.id, openGroup.id], Post.Type.DISCUSSION)
    expect(message).to.equal('Hylo Stewards / gatherings, Hylo Stewards / partnerships and None Accepted do not accept discussion posts')
  })
})

describe('assertGroupsAcceptPostType error extensions', () => {
  let parentGroup, chatSpace, discussionOnly

  before(async function () {
    parentGroup = new Group({ slug: 'apt-ext-parent', name: 'Ext Parent' })
    discussionOnly = new Group({ slug: 'apt-ext-discussion', name: 'Ext Discussion Only', accepted_post_types: ['discussion'] })
    await Promise.all([parentGroup.save(), discussionOnly.save()])
    chatSpace = new Group({ slug: 'apt-ext-chat-space', name: 'partnerships', type: 'space', parent_id: parentGroup.id, accepted_post_types: ['chat'] })
    await chatSpace.save()
  })

  const rejection = (groupIds, postType) =>
    assertGroupsAcceptPostType(groupIds, postType)
      .then(() => expect.fail('should reject'), e => e)

  it('carries the code, post type and blocker label so clients can translate the message', async () => {
    const error = await rejection([parentGroup.id, chatSpace.id], Post.Type.DISCUSSION)
    expect(error.extensions).to.deep.equal({
      code: POST_TYPE_NOT_ACCEPTED,
      postType: 'discussion',
      destinations: ['Ext Parent / partnerships']
    })
    // English fallback for clients that don't know the code
    expect(error.message).to.equal('Ext Parent / partnerships does not accept discussion posts')
  })

  it('lists every blocker label in the order given', async () => {
    const error = await rejection([discussionOnly.id, parentGroup.id, chatSpace.id], Post.Type.EVENT)
    expect(error.extensions.code).to.equal('POST_TYPE_NOT_ACCEPTED')
    expect(error.extensions.postType).to.equal('event')
    expect(error.extensions.destinations).to.deep.equal(['Ext Discussion Only', 'Ext Parent / partnerships'])
  })
})

describe('destinationLabel', () => {
  it('uses the parent name only for spaces', () => {
    const space = new Group({ id: 2, name: 'partnerships', type: 'space', parent_id: 1 })
    const group = new Group({ id: 3, name: 'Some Group', parent_id: 1 })
    expect(destinationLabel(space, { 1: 'Hylo Stewards' })).to.equal('Hylo Stewards / partnerships')
    expect(destinationLabel(group, { 1: 'Hylo Stewards' })).to.equal('Some Group')
    expect(destinationLabel(space, {})).to.equal('partnerships')
  })
})
