import { mapStateToProps, mergeProps } from './Members.connector'
import { MODULE_NAME } from './Members.store'
import orm from '../../../store/models'

describe('mapStateToProps', () => {
  it('handles null value for lastViewedCommunity', () => {
    const session = orm.session(orm.getEmptyState())
    session.Me.create({id: 123})
    const state = {
      orm: session.state,
      [MODULE_NAME]: {},
      pending: {},
      queryResults: {}
    }
    expect(mapStateToProps(state)).toMatchSnapshot()
  })
})

describe('mergeProps', () => {
  let dispatchProps, stateProps

  beforeEach(() => {
    dispatchProps = { fetchMembers: jest.fn() }
    stateProps = { hasMore: true, members: [], pending: false }
  })

  it('makes fetchMembers a no-op when there is no community', () => {
    const props = mergeProps(stateProps, dispatchProps)
    expect(props.fetchMembers()).toEqual(false)
    expect(dispatchProps.fetchMembers).not.toBeCalled()
  })

  it("makes fetchMoreMembers an empty function if there ain't no more", () => {
    stateProps.hasMore = false
    const actual = mergeProps(stateProps, dispatchProps)
    actual.fetchMoreMembers()
    expect(dispatchProps.fetchMembers).not.toHaveBeenCalled()
  })

  it('calls fetchMembers with the correct offset when fetchMoreMembers is called', () => {
    stateProps.members = [ 'so', 'many', 'members' ]
    const actual = mergeProps(stateProps, dispatchProps)
    actual.fetchMoreMembers()
    expect(dispatchProps.fetchMembers.mock.calls[0][0].offset).toBe(stateProps.members.length)
  })
})
