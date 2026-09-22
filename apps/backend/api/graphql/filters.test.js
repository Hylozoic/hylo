import { isGroupVisibleToViewer, loadGroupVisibilityContext, makeFilterToggle } from './filters'
import makeModels from './makeModels'
import { expectEqualQuery } from '../../test/setup/helpers'
import {
  myGroupIdsSqlFragment
} from '../../test/unit/models/Group.test'
import factories from '../../test/setup/factories'

const myId = '42'

var models, sharedMemberships

const setupBlockedUserData = async () => {
  const u1 = factories.user()
  const u2 = factories.user()
  const u3 = factories.user()
  const u4 = factories.user()
  const group = factories.group()
  await u1.save()
  await u2.save()
  await u3.save()
  await u4.save()
  await group.save()
  await u1.joinGroup(group)
  await u2.joinGroup(group)
  await u3.joinGroup(group)
  await u4.joinGroup(group)
  await BlockedUser.create(u1.id, u2.id)
  await BlockedUser.create(u3.id, u1.id)
  return {u1, u2, u3, u4, group}
}

export function blockedUserSqlFragment (userId) {
  return `(
    SELECT user_id
    FROM blocked_users
    WHERE blocked_user_id = '${userId}'
    UNION
    SELECT blocked_user_id
    FROM blocked_users
    WHERE user_id = '${userId}'
  )`
}

describe('makeFilterToggle', () => {
  var filterFn = relation => relation.query(q => 'filtered')
  var relation = {query: fn => fn()}

  it('adds a filter when enabled', () => {
    expect(makeFilterToggle(true)(filterFn)(relation)).to.equal('filtered')
  })

  it('adds no filter when disabled', () => {
    expect(makeFilterToggle(false)(filterFn)(relation)).to.equal(relation)
  })
})

describe('model filters', () => {
  before(async () => {
    sharedMemberships = `"group_memberships"
      where "group_memberships"."group_id" in (
        select "group_id" from "group_memberships"
        where "group_memberships"."user_id" in ('${myId}', '${User.AXOLOTL_ID}')
        and "group_memberships"."active" = true
      )`

    models = await makeModels(myId, false)
  })

  describe('Membership', () => {
    it('filters down to memberships for groups the user is in', () => {
      const collection = models.Membership.filter(GroupMembership.collection())
      expectEqualQuery(collection, `select * from ${sharedMemberships}`)
    })
  })

  describe('Person', () => {
    var u1, u4;

    before(async () => {
      const blockedUserData = await setupBlockedUserData()
      u1 = blockedUserData.u1
      u4 = blockedUserData.u4
    })

    it('filters out blocked and blocking users', async () => {
      const models = await makeModels(u1.id, false)
      const users = await models.Person.filter(User.collection()).fetch()
      expect(users.map('id')).to.deep.equal([u1.id, u4.id])
    })

    it('includes people you share a connection with', async () => {
      const currentUser = await factories.user().save()
      const connectedUser = await factories.user().save()
      // another user
      await factories.user().save()
      await UserConnection.create(currentUser.id, connectedUser.id, UserConnection.Type.MESSAGE)

      const models = await makeModels(currentUser.id, false)
      const users = await models.Person.filter(User.collection()).fetch()
      expect(users.map('id')).to.deep.equal([connectedUser.id])
    })

    it('filters down to people that share a group with the user', () => {
      const collection = models.Person.filter(User.collection())

      expectEqualQuery(collection, `select * from "users"
        where
        "users"."id" not in ${blockedUserSqlFragment(myId)}
        and
        ("users"."id" = '${User.AXOLOTL_ID}' or
          "users"."id" in
            (select "group_memberships"."user_id"
            from "group_memberships"
            where "group_memberships"."group_id" in ${myGroupIdsSqlFragment(myId)})
          or "users"."id" in (select "other_user_id" from "user_connections" where "user_connections"."user_id" = '${myId}'))`)
    })
  })

  describe('Post', () => {
    var u1, u2, u3, u4, group;

    before(async () => {
      const blockedUserData = await setupBlockedUserData()
      u1 = blockedUserData.u1
      u2 = blockedUserData.u2
      u3 = blockedUserData.u3
      u4 = blockedUserData.u4
      group = blockedUserData.group
      const p1 = factories.post({user_id: u2.id})
      const p2 = factories.post({user_id: u3.id})
      const p3 = factories.post({user_id: u4.id})
      await p1.save({active: true})
      await p1.groups().attach(group)
      await p2.save({active: true})
      await p2.groups().attach(group)
      await p3.save({active: true})
      await p3.groups().attach(group)
    })

    it('filters posts by blocked and blocking users', async () => {
      const models = await makeModels(u1.id, false)
      const posts = await models.Post.filter(Post.collection()).fetch()
      expect(posts.models.map(p => p.get('user_id'))).to.deep.equal([u4.id])
    })

    it('filters down to active posts in the right groups ', () => {
      const collection = models.Post.filter(Post.collection())

      expectEqualQuery(collection, `select * from "posts"
        inner join "groups_posts" on "groups_posts"."post_id" = "posts"."id"
        where "posts"."active" = true
        and ("groups_posts"."group_id" in
          ${myGroupIdsSqlFragment(myId)}
          or "posts"."is_public" = true
        )
        and "posts"."user_id" not in ${blockedUserSqlFragment(myId)}`)
    })
  })

  describe('Comment', () => {
    it('filters down to active comments on posts in the right groups or followed posts', () => {
      const collection = models.Comment.filter(Comment.collection())

      expectEqualQuery(collection, `select distinct * from "comments"
        left join "groups_posts"
          on "comments"."post_id" = "groups_posts"."post_id"
        inner join "posts" on "groups_posts"."post_id" = "posts"."id"
        where "comments"."active" = true
        and "comments"."user_id" not in ${blockedUserSqlFragment(myId)}
        and (
          "comments"."post_id" in (
            select "post_id" from "posts_users"
            where "posts_users"."user_id" = '${myId}'
            and "posts_users"."following" = true
            and "posts_users"."active" = true
          )
          or "groups_posts"."group_id" in ${myGroupIdsSqlFragment(myId)}
          or "posts"."is_public" = true
        ) group by "comments"."id"`)
    })
  })
})

describe('isGroupVisibleToViewer', () => {
  const HIDDEN = 0
  const PROTECTED = 1
  const PUBLIC = 2
  const fakeGroup = (attrs) => ({
    id: attrs.id,
    get: key => attrs[key]
  })
  const emptyCtx = {
    memberIds: new Set(),
    parentIds: new Set(),
    childIds: new Set(),
    peerIds: new Set(),
    stewardChildIds: new Set(),
    stewardPeerIds: new Set(),
    joinManagerIds: new Set()
  }

  it('shows public groups to anyone', () => {
    expect(isGroupVisibleToViewer(fakeGroup({ id: '1', visibility: PUBLIC }), null, null)).to.equal(true)
  })

  it('hides a protected group with no relationship', () => {
    expect(isGroupVisibleToViewer(fakeGroup({ id: '9', visibility: PROTECTED }), emptyCtx, '42')).to.equal(false)
  })

  it('shows a protected group the viewer belongs to', () => {
    const ctx = { ...emptyCtx, memberIds: new Set(['9']) }
    expect(isGroupVisibleToViewer(fakeGroup({ id: '9', visibility: PROTECTED }), ctx, '42')).to.equal(true)
  })

  it('shows a protected parent of a group the viewer belongs to', () => {
    const ctx = { ...emptyCtx, parentIds: new Set(['3']) }
    expect(isGroupVisibleToViewer(fakeGroup({ id: '3', visibility: PROTECTED }), ctx, '42')).to.equal(true)
  })

  it('shows a protected child of a group the viewer belongs to', () => {
    const ctx = { ...emptyCtx, childIds: new Set(['4']) }
    expect(isGroupVisibleToViewer(fakeGroup({ id: '4', visibility: PROTECTED }), ctx, '42')).to.equal(true)
  })

  it('hides a hidden child unless the viewer stewards the parent', () => {
    const child = fakeGroup({ id: '5', visibility: HIDDEN })
    expect(isGroupVisibleToViewer(child, { ...emptyCtx, childIds: new Set(['5']) }, '42')).to.equal(false)
    expect(isGroupVisibleToViewer(child, { ...emptyCtx, stewardChildIds: new Set(['5']) }, '42')).to.equal(true)
  })

  it('shows a protected peer of a group the viewer belongs to', () => {
    const ctx = { ...emptyCtx, peerIds: new Set(['6']) }
    expect(isGroupVisibleToViewer(fakeGroup({ id: '6', visibility: PROTECTED }), ctx, '42')).to.equal(true)
  })

  it('shows a hidden space when the viewer can manage the parent', () => {
    const space = fakeGroup({ id: '7', visibility: HIDDEN, type: 'space', parent_id: '1' })
    expect(isGroupVisibleToViewer(space, { ...emptyCtx, memberIds: new Set(['1']) }, '42')).to.equal(false)
    expect(isGroupVisibleToViewer(space, { ...emptyCtx, joinManagerIds: new Set(['1']) }, '42')).to.equal(true)
  })

  it('does not treat every non-hidden group as visible when childIds is polluted', () => {
    const ctx = { ...emptyCtx, childIds: new Set(['99']) }
    expect(isGroupVisibleToViewer(fakeGroup({ id: '99', visibility: PROTECTED }), ctx, '42')).to.equal(true)
    expect(isGroupVisibleToViewer(fakeGroup({ id: '88', visibility: PROTECTED }), ctx, '42')).to.equal(false)
  })
})

describe('loadGroupVisibilityContext', () => {
  it('does not include an unrelated protected parent of someone else\'s group', async () => {
    const viewer = await factories.user().save()
    const myGroup = await factories.group().save()
    await viewer.joinGroup(myGroup)

    const stranger = await factories.user().save()
    const protectedParent = await factories.group({ visibility: Group.Visibility.PROTECTED }).save()
    const protectedChild = await factories.group({ visibility: Group.Visibility.PROTECTED }).save()
    await stranger.joinGroup(protectedChild)
    await protectedParent.addChild(protectedChild)

    const ctx = await loadGroupVisibilityContext(viewer.id)
    expect(ctx.memberIds.has(String(myGroup.id))).to.equal(true)
    expect(ctx.parentIds.has(String(protectedParent.id))).to.equal(false)
    expect(ctx.childIds.has(String(protectedChild.id))).to.equal(false)
    expect(isGroupVisibleToViewer({
      id: protectedParent.id,
      get: key => key === 'visibility' ? Group.Visibility.PROTECTED : null
    }, ctx, viewer.id)).to.equal(false)
  })

  it('does not treat an inactive parent membership as related', async () => {
    const viewer = await factories.user().save()
    const parent = await factories.group({ visibility: Group.Visibility.PROTECTED }).save()
    const child = await factories.group({ visibility: Group.Visibility.PROTECTED }).save()
    await parent.addChild(child)
    await viewer.joinGroup(parent)
    await parent.removeMembers([viewer.id])

    const ctx = await loadGroupVisibilityContext(viewer.id)
    expect(ctx.memberIds.has(String(parent.id))).to.equal(false)
    expect(ctx.childIds.has(String(child.id))).to.equal(false)
    expect(ctx.stewardChildIds.has(String(child.id))).to.equal(false)
    expect(isGroupVisibleToViewer({
      id: child.id,
      get: key => key === 'visibility' ? Group.Visibility.PROTECTED : null
    }, ctx, viewer.id)).to.equal(false)
  })

  it('does not show a protected space after leaving the parent', async () => {
    const viewer = await factories.user().save()
    const parent = await factories.group({ visibility: Group.Visibility.PROTECTED }).save()
    const space = await factories.group({
      visibility: Group.Visibility.PROTECTED,
      type: 'space',
      parent_id: parent.id
    }).save()
    await viewer.joinGroup(parent)
    await parent.removeMembers([viewer.id])

    const ctx = await loadGroupVisibilityContext(viewer.id)
    expect(ctx.memberIds.has(String(parent.id))).to.equal(false)
    expect(ctx.joinManagerIds.has(String(parent.id))).to.equal(false)
    expect(isGroupVisibleToViewer({
      id: space.id,
      get: key => {
        if (key === 'visibility') return Group.Visibility.PROTECTED
        if (key === 'type') return 'space'
        if (key === 'parent_id') return parent.id
        return null
      }
    }, ctx, viewer.id)).to.equal(false)
  })
})

