import { mapStateToProps, mapDispatchToProps, mergeProps, makeFetchOpts } from './Members.connector'
import { MODULE_NAME } from './Members.store'
import orm from 'store/models'

jest.mock('store/selectors/getCurrentGroupSlug', () => () => 'tom')

describe('makeFetchOpts', () => {
  it('handles a group', () => {
    const props = {
      group: {
        slug: 'comslug'
      },
      sortBy: 'join',
      search: 'fee'
    }
    expect(makeFetchOpts(props)).toMatchSnapshot()
  })

  it('handles no group', () => {
    const props = {
      group: null,
      sortBy: 'join',
      search: 'fee'
    }
    expect(makeFetchOpts(props)).toMatchSnapshot()
  })
})

describe('mapStateToProps', () => {
  it('handles null value for lastViewedGroup', () => {
    const session = orm.session(orm.getEmptyState())
    const group = session.Group.create({ id: '10', slug: 'tom' })
    session.Me.create({
      id: 123,
      groupRoles: { items: [] },
      membershipCommonRoles: { items: [] },
      memberships: [session.Membership.create({
        id: '345',
        group: group.id,
        hasModeratorRole: true
      })]
    })

    const state = {
      orm: session.state,
      [MODULE_NAME]: {},
      pending: {},
      queryResults: {}
    }
    session.Group.create({})
    expect(mapStateToProps(state)).toMatchSnapshot()
  })
})

describe('mapDispatchToProps', () => {
  it('returns the right keys', () => {
    expect(mapDispatchToProps(() => {})).toMatchSnapshot()
  })
})

describe('mergeProps', () => {
  let dispatchProps, stateProps

  beforeEach(() => {
    dispatchProps = { fetchMembers: jest.fn() }
    stateProps = { hasMore: true, members: [], pending: false }
  })

  it('makes fetchMembers a no-op when there is no group', () => {
    const props = mergeProps(stateProps, dispatchProps)
    expect(props.fetchMembers()).toEqual(undefined)
    expect(dispatchProps.fetchMembers).not.toBeCalled()
  })

  it("makes fetchMoreMembers an empty function if there ain't no more", () => {
    stateProps.hasMore = false
    const actual = mergeProps(stateProps, dispatchProps)
    actual.fetchMoreMembers()
    expect(dispatchProps.fetchMembers).not.toHaveBeenCalled()
  })

  it('calls fetchMembers with the correct offset when fetchMoreMembers is called', () => {
    stateProps.members = ['so', 'many', 'members']
    const actual = mergeProps(stateProps, dispatchProps)
    actual.fetchMoreMembers()
    expect(dispatchProps.fetchMembers.mock.calls[0][0].offset).toBe(stateProps.members.length)
  })
})
