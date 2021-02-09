import { mapStateToProps, mapDispatchToProps, mergeProps } from './Feed.connector'
import orm from 'store/models'
import { showToast } from 'util/toast'

jest.mock('util/toast', () => ({
  showToast: jest.fn()
}))

// let session, state

describe('mapStateToProps', () => {
  beforeAll(() => {
    // session = orm.session(orm.getEmptyState())
    // state = { orm: session.state }
  })
  
  // it('handles a null navigation object', () => {
  //   const props = {
  //     route: {}
  //   }
  //   expect(mapStateToProps(state, props)).toEqual({
  //     group: undefined,
  //     currentUser: undefined,
  //     topic: undefined,
  //     topicSubscribed: undefined,
  //     topicName: undefined,
  //     followersTotal: undefined,
  //     postsTotal: undefined,
  //     currentUserHasMemberships: false
  //   })
  // })

  it('gets props from navigation object', () => {
    const session = orm.session()
    const currentUser = session.Me.create({ name: 'me' })
    const group = session.Group.create({
      id: '7',
      slug: 'world'
    })
    const topic = session.Topic.create({
      id: '111',
      name: 'logistics'
    })
    session.GroupTopic.create({
      group: '7',
      topic: '111',
      isSubscribed: false,
      followersTotal: 10,
      postsTotal: 20
    })
    const state = { orm: session.state }
    const props = {
      route: {
        params: {
          topicName: 'logistics',
          groupId: '7'
        }
      }
    }
    const secondProps = {
      route: {
        params: {
          topicName: 'logistics',
          groupSlugFromLink: 'world'
        }
      }
    }
    const firstMapping = mapStateToProps(state, props)
    const secondMapping = mapStateToProps(state, secondProps)

    expect(firstMapping).toEqual({
      group: group.ref,
      currentUser,
      topicName: 'logistics',
      currentUserHasMemberships: false,
      topicFollowersTotal: 10,
      topicPostsTotal: 20,
      topic: topic.ref,
      topicSubscribed: false
    })
    expect(firstMapping.group === secondMapping.group).toBeTruthy()
  })

})

//   it('has topicSubscribed=true when subscribed', async () => {
//     const session = await orm.session(orm.getEmptyState())
//     const state = await { orm: session.state }
//     await session.Group.create({ id: '7', slug: 'world' })
//     await session.Topic.create({ id: '1', name: 'foo' })
//     await session.GroupTopic.create({ group: '7', topic: '1', isSubscribed: true })
//     const props = {
//       topicName: 'foo',
//       route: {
//         params: {
//           groupId: '7'
//         }
//       }
//     }

//     expect(mapStateToProps(state, props)).toEqual(expect.objectContaining({
//       topicSubscribed: true
//     }))
//   })
// })

// describe('mergeProps', () => {
//   let navigation, dispatch, dispatchProps, stateProps, ownProps

//   beforeEach(() => {
//     navigation = { navigate: jest.fn(), push: jest.fn() }
//     dispatch = jest.fn(x => x)
//     dispatchProps = mapDispatchToProps(dispatch, { navigation })
//     stateProps = { group: { id: '12', slug: 'life' }, otherProp1: 'foo1' }
//     ownProps = { otherProp2: 'foo2', navigation }
//   })

//   it('binds groupId to functions from dispatchProps', () => {
//     const props = mergeProps(stateProps, dispatchProps, ownProps)
//     expect(props).toMatchSnapshot()

//     props.newPost()
//     expect(navigation.navigate)
//       .toBeCalledWith('Edit Post', { groupId: '12', topicName: undefined })

//     props.showTopic('disarmament')
//     expect(navigation.push)
//       .toBeCalledWith('Topic Feed', { groupId: '12', topicName: 'disarmament' })
//   })

//   it('binds networkId to showTopic from dispatchProps', () => {
//     const testStateProps = {
//       ...stateProps,
//       network: { id: 'anynetworkId' }
//     }
//     const props = mergeProps(
//       testStateProps,
//       dispatchProps,
//       ownProps
//     )

//     props.showTopic('anything')
//     expect(showToast).toBeCalled()
//   })

//   it('sets up fetchGroupTopic', () => {
//     stateProps.topicName = 'inquiry'
//     const props = mergeProps(stateProps, dispatchProps, ownProps)
//     expect(props.fetchGroupTopic()).toMatchSnapshot()
//   })

//   it('sets up setTopicSubscribe', () => {
//     stateProps.topic = { id: '5', name: 'inquiry' }
//     const props = mergeProps(stateProps, dispatchProps, ownProps)
//     expect(props.setTopicSubscribe()).toMatchSnapshot()
//   })
// })
