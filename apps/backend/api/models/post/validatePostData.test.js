import validatePostData, { groupAcceptsPostType, assertGroupsAcceptPostType } from './validatePostData'

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

  it('treats requests-and-offers as an alias for request and offer', () => {
    expect(groupAcceptsPostType(['requests-and-offers'], 'request')).to.equal(true)
    expect(groupAcceptsPostType(['requests-and-offers'], 'offer')).to.equal(true)
    expect(groupAcceptsPostType(['requests-and-offers'], 'discussion')).to.equal(false)
  })
})

describe('assertGroupsAcceptPostType', () => {
  var openGroup, discussionOnly, noneAccepted

  before(function () {
    openGroup = new Group({ slug: 'apt-open', name: 'Open Group' })
    discussionOnly = new Group({ slug: 'apt-discussion', name: 'Discussion Only', accepted_post_types: ['discussion'] })
    noneAccepted = new Group({ slug: 'apt-none', name: 'None Accepted', accepted_post_types: [] })
    return Promise.all([openGroup.save(), discussionOnly.save(), noneAccepted.save()])
  })

  it('allows a restricted type when accepted_post_types is null', () => {
    return assertGroupsAcceptPostType([openGroup.id], Post.Type.EVENT)
  })

  it('rejects a type the group does not accept', () => {
    return assertGroupsAcceptPostType([discussionOnly.id], Post.Type.EVENT)
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e.message).to.match(/Discussion Only does not accept event posts/))
  })

  it('rejects a restricted type when accepted_post_types is empty', () => {
    return assertGroupsAcceptPostType([noneAccepted.id], Post.Type.DISCUSSION)
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e.message).to.match(/None Accepted does not accept discussion posts/))
  })

  it('allows chat when accepted_post_types is empty', () => {
    return assertGroupsAcceptPostType([noneAccepted.id], Post.Type.CHAT)
  })

  it('rejects when any of several groups does not accept the type', () => {
    return assertGroupsAcceptPostType([openGroup.id, discussionOnly.id], Post.Type.EVENT)
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e.message).to.match(/does not accept event posts/))
  })
})
