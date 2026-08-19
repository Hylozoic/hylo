import orm from '../models'
import getMe from './getMe'
import getGroupTopicForCurrentRoute from './getGroupTopicForCurrentRoute'
import getTopicForCurrentRoute from './getTopicForCurrentRoute'
import getMyMemberships from './getMyMemberships'
import { getMyGroups, getMyGroupsWithChildren } from './getMyGroups'
import hasResponsibilityForGroup from './hasResponsibilityForGroup'
import { getLastViewedGroupPath } from './getLastViewedGroup'

describe('getMe', () => {
  it('returns Me', () => {
    const session = orm.session(orm.getEmptyState())
    session.Me.create({
      id: '1',
      name: 'Joe Smith'
    })

    const result = getMe({ orm: session.state })

    expect(result.name).toEqual('Joe Smith')
    expect(result.id).toEqual('1')
  })
})

describe('getMyMemberships', () => {
  it('returns expected values', () => {
    const session = orm.session(orm.getEmptyState())
    const group1 = session.Group.create({ id: 'c1' })
    const group2 = session.Group.create({ id: 'c2' })
    session.Membership.create({ id: 'm1', group: group1.id })
    const me = session.Me.create({ id: 1 })
    session.Membership.create({ id: 'm2', group: group2.id, person: me.id })
    expect(getMyMemberships({ orm: session.state }, {})).toHaveLength(1)
  })
})

describe('getGroupTopicForCurrentRoute', () => {
  it('returns GroupTopic', () => {
    const session = orm.session(orm.getEmptyState())
    session.Group.create({ id: '1', slug: 'goteam' })
    session.Topic.create({
      id: '2',
      name: 'petitions',
      postsTotal: '100',
      followersTotal: '200'
    })
    session.GroupTopic.create({
      id: '3',
      group: '1',
      topic: '2',
      postsTotal: '10',
      followersTotal: '20'
    })
    const result = getGroupTopicForCurrentRoute({ orm: session.state }, 'goteam', 'petitions')
    expect(result.postsTotal).toEqual('10')
    expect(result.id).toEqual('3')
  })

  it('should return null if no match', () => {
    const session = orm.session(orm.getEmptyState())
    const result = getGroupTopicForCurrentRoute({ orm: session.state }, 'goteam', 'petitions')
    expect(result).toBeNull()
  })
})

describe('getTopicForCurrentRoute', () => {
  it('returns Topic', () => {
    const session = orm.session(orm.getEmptyState())
    session.Topic.create({
      id: '2',
      name: 'petitions'
    })
    const result = getTopicForCurrentRoute({ orm: session.state }, 'petitions')
    expect(result.name).toEqual('petitions')
    expect(result.id).toEqual('2')
  })

  it('should return null if no match', () => {
    const session = orm.session(orm.getEmptyState())
    const result = getTopicForCurrentRoute({ orm: session.state }, 'petitions')
    expect(result).toBeNull()
  })
})

describe('hasResponsibilityForGroup', () => {
  const session = orm.session(orm.getEmptyState())
  let group, me

  beforeEach(() => {
    group = session.Group.create({ id: 1 })
    me = session.Me.create({
      id: '1',
      groupRoles: {
        items: [{
          id: 1,
          groupId: group.id,
          name: 'Coordinator',
          responsibilities: {
            items: [
              { id: 1, title: 'Administration' },
              { id: 2, title: 'Manage Content' }
            ]
          }
        }]
      }
    })
    session.Membership.create({ id: 1, group: group.id, person: 1 })
  })

  it('returns true when user can moderate', () => {
    const state = { orm: session.state }
    const props = { person: me, groupId: group.id, responsibility: 'Manage Content' }
    expect(hasResponsibilityForGroup(state, props)).toEqual(true)
  })

  it('returns false when user cannot moderate', () => {
    group = session.Group.create({ id: 2 })
    const state = { orm: session.state }
    const props = { person: me, groupId: group.id, responsibility: 'Manage Content' }
    expect(hasResponsibilityForGroup(state, props)).toBeFalsy()
  })

  it('inherits parent roles when checking a space', () => {
    const space = session.Group.create({ id: 10, type: 'space', parentId: group.id })
    const state = { orm: session.state }
    const props = { person: me, groupId: space.id, responsibility: 'Administration' }
    expect(hasResponsibilityForGroup(state, props)).toEqual(true)
  })
})

describe('getLastViewedGroupPath', () => {
  it('returns nested space path when last viewed group is a space', () => {
    const session = orm.session(orm.getEmptyState())
    const me = session.Me.create({ id: 1 })
    const parent = session.Group.create({ id: '1', name: 'Parent Group', slug: 'parent-group' })
    const space = session.Group.create({
      id: '2',
      name: 'Alpha Space',
      slug: 'parent-group-alpha',
      type: 'space',
      parentId: parent.id,
      homeRoute: '/all'
    })
    session.Membership.create({
      id: 'm1',
      group: parent.id,
      person: me.id,
      lastViewedAt: '2020-01-01T00:00:00.000Z'
    })
    session.Membership.create({
      id: 'm2',
      group: space.id,
      person: me.id,
      lastViewedAt: '2024-01-01T00:00:00.000Z'
    })

    expect(getLastViewedGroupPath({ orm: session.state })).toEqual('/groups/parent-group/spaces/alpha/all')
  })

  it('returns top-level group path for non-space groups', () => {
    const session = orm.session(orm.getEmptyState())
    const me = session.Me.create({ id: 1 })
    const group = session.Group.create({ id: '1', name: 'Parent Group', slug: 'parent-group' })
    session.Membership.create({
      id: 'm1',
      group: group.id,
      person: me.id,
      lastViewedAt: '2024-01-01T00:00:00.000Z'
    })

    expect(getLastViewedGroupPath({ orm: session.state })).toEqual('/groups/parent-group')
  })
})

describe('getMyGroupsWithChildren', () => {
  it('nests space memberships under their parent group', () => {
    const session = orm.session(orm.getEmptyState())
    const me = session.Me.create({ id: 1 })
    const parent = session.Group.create({ id: '1', name: 'Parent Group', slug: 'parent-group' })
    const space = session.Group.create({ id: '2', name: 'Alpha Space', slug: 'alpha-space', type: 'space', parentId: parent.id })
    session.Membership.create({ id: 'm1', group: parent.id, person: me.id })
    session.Membership.create({ id: 'm2', group: space.id, person: me.id })

    const result = getMyGroupsWithChildren({ orm: session.state })

    expect(result).toHaveLength(1)
    expect(result[0].name).toEqual('Parent Group')
    expect(result[0].spaces).toHaveLength(1)
    expect(result[0].spaces[0].name).toEqual('Alpha Space')
  })

  it('excludes spaces from the top-level list', () => {
    const session = orm.session(orm.getEmptyState())
    const me = session.Me.create({ id: 1 })
    const parent = session.Group.create({ id: '1', name: 'Parent Group', slug: 'parent-group' })
    const space = session.Group.create({ id: '2', name: 'Beta Space', slug: 'beta-space', type: 'space', parentId: parent.id })
    session.Membership.create({ id: 'm1', group: parent.id, person: me.id })
    session.Membership.create({ id: 'm2', group: space.id, person: me.id })

    const result = getMyGroups({ orm: session.state })

    expect(result).toHaveLength(1)
    expect(result[0].slug).toEqual('parent-group')
  })
})
