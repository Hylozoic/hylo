/* eslint-env jest */
import { merge } from 'lodash'
import orm from 'store/models'
import { GROUP_TYPES } from 'store/models/Group'
import reducer, {
  FETCH_LINK_PREVIEW,
  REMOVE_LINK_PREVIEW,
  CLEAR_LINK_PREVIEW,
  defaultState,
  fetchLinkPreview,
  getPostEditorDestinationGroups
} from './PostEditor.store'

describe('PostEditor store', () => {
  const validLinkPreview = {
    id: 'found',
    title: 'has a title'
  }
  describe('reducer', () => {
    describe(`when ${FETCH_LINK_PREVIEW}`, () => {
      test('linkPreviewId is set if record is found', () => {
        const action = merge(fetchLinkPreview(), {
          payload: {
            data: {
              findOrCreateLinkPreviewByUrl: validLinkPreview
            }
          }
        })
        const finalState = reducer(defaultState, action)
        expect(finalState.linkPreviewId).toEqual(validLinkPreview.id)
        expect(finalState.linkPreviewStatus).toEqual(null)
        expect(finalState).toMatchSnapshot()
      })
      test('linkPreviewId is not set status is "invalid" if a record is not found', () => {
        const action = merge(fetchLinkPreview(), {
          payload: {
            data: {
              findOrCreateLinkPreviewByUrl: {}
            }
          }
        })
        const finalState = reducer(defaultState, action)
        expect(finalState.linkPreviewId).toBeFalsy()
        expect(finalState.linkPreviewStatus).toEqual('invalid')
        expect(finalState).toMatchSnapshot()
      })
    })

    describe(`when ${REMOVE_LINK_PREVIEW}`, () => {
      const action = { type: REMOVE_LINK_PREVIEW }
      test('linkPreviewId is cleared and status set to "removed"', () => {
        const finalState = reducer(defaultState, action)
        expect(finalState.linkPreviewId).toBeFalsy()
        expect(finalState.linkPreviewStatus).toEqual('removed')
        expect(finalState).toMatchSnapshot()
      })
    })

    describe(`when ${CLEAR_LINK_PREVIEW}`, () => {
      const action = { type: CLEAR_LINK_PREVIEW }
      test('linkPreviewId is cleared and status set to "cleared"', () => {
        const finalState = reducer(defaultState, action)
        expect(finalState.linkPreviewId).toBeFalsy()
        expect(finalState.linkPreviewStatus).toEqual('cleared')
        expect(finalState).toMatchSnapshot()
      })
    })

  })
})

describe('getPostEditorDestinationGroups', () => {
  it('includes the parent group and sibling spaces with parentId from memberships', () => {
    const session = orm.mutableSession(orm.getEmptyState())
    const me = session.Me.create({ id: '1' })
    const parent = session.Group.create({
      id: '10',
      name: 'Parent Group',
      slug: 'parent-group',
      type: null
    })
    session.Group.create({
      id: '20',
      name: 'Current Space',
      slug: 'current-space',
      type: GROUP_TYPES.space,
      parentId: parent.id
    })
    const sibling = session.Group.create({
      id: '21',
      name: 'Sibling Space',
      slug: 'sibling-space',
      type: GROUP_TYPES.space,
      parentId: parent.id
    })
    session.Membership.create({ id: 'm-parent', group: parent.id, person: me.id })
    session.Membership.create({ id: 'm-current', group: '20', person: me.id })
    session.Membership.create({ id: 'm-sibling', group: sibling.id, person: me.id })

    const result = getPostEditorDestinationGroups({ orm: session.state }, parent.id)
    expect(result.map(g => String(g.id))).toEqual(expect.arrayContaining(['10', '20', '21']))
    expect(result.find(g => String(g.id) === String(sibling.id)).parentId).toEqual(parent.id)
  })

  it('includes the parent group even when acceptedPostTypes is empty', () => {
    const session = orm.mutableSession(orm.getEmptyState())
    const me = session.Me.create({ id: '1' })
    const parent = session.Group.create({
      id: '10',
      name: 'Parent Group',
      slug: 'parent-group',
      acceptedPostTypes: []
    })
    session.Membership.create({ id: 'm-parent', group: parent.id, person: me.id })

    const result = getPostEditorDestinationGroups({ orm: session.state }, parent.id)
    expect(result.find(g => String(g.id) === '10')).toMatchObject({ name: 'Parent Group' })
  })

  it('picks up parentId after a later Group update (does not stay stale)', () => {
    const session = orm.session(orm.getEmptyState())
    const me = session.Me.create({ id: '1' })
    const parent = session.Group.create({ id: '10', name: 'Parent Group', slug: 'parent' })
    session.Group.create({
      id: '20',
      name: 'Current Space',
      slug: 'current-space',
      type: GROUP_TYPES.space
    })
    session.Membership.create({ id: 'm-parent', group: parent.id, person: me.id })
    session.Membership.create({ id: 'm-space', group: '20', person: me.id })

    const before = getPostEditorDestinationGroups({ orm: session.state }, parent.id)
    expect(before.find(g => String(g.id) === '20').parentId).toBeFalsy()

    const nextSession = orm.session(session.state)
    nextSession.Group.withId('20').update({ parentId: parent.id })
    const after = getPostEditorDestinationGroups({ orm: nextSession.state }, parent.id)
    expect(after.find(g => String(g.id) === '20').parentId).toEqual(parent.id)
  })

  it('includes sibling spaces from the parent menu even without a membership', () => {
    const session = orm.mutableSession(orm.getEmptyState())
    const me = session.Me.create({ id: '1' })
    const parent = session.Group.create({
      id: '10',
      name: 'Parent Group',
      slug: 'parent-group',
      groupViews: {
        items: [{
          type: 'space',
          linkedGroup: {
            id: '22',
            name: 'Menu Space',
            slug: 'menu-space',
            type: GROUP_TYPES.space
          }
        }]
      },
      spaces: {
        items: [{
          id: '23',
          name: 'Off Menu Space',
          slug: 'off-menu-space',
          type: GROUP_TYPES.space
        }]
      }
    })
    session.Membership.create({ id: 'm-parent', group: parent.id, person: me.id })

    const result = getPostEditorDestinationGroups({ orm: session.state }, parent.id)
    expect(result.find(g => String(g.id) === '22')).toMatchObject({
      name: 'Menu Space',
      parentId: parent.id,
      type: GROUP_TYPES.space
    })
    expect(result.find(g => String(g.id) === '23')).toMatchObject({
      name: 'Off Menu Space',
      parentId: parent.id,
      type: GROUP_TYPES.space
    })
  })
})
