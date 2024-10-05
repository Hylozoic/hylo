import { mapStateToProps, mapDispatchToProps } from './Thread.connector'
import orm from 'store/models'

jest.mock('util/websockets', () => ({
  sendIsTyping: jest.fn()
}))

jest.mock('store/selectors/getCurrentGroupSlug', () => () => 'public')

jest.mock('store/selectors/getCurrentUserId', () => () => {})

let ormSession

describe('mapStateToProps', () => {
  beforeAll(() => {
    ormSession = orm.session(orm.getEmptyState())
  })

  it('returns the right keys', () => {
    ormSession.MessageThread.create({ id: 1 })
    const state = {
      queryResults: [],
      pending: [],
      SocketListener: {},
      orm: ormSession.state
    }
    const props = {
      route: {
        params: { id: 1 }
      },
      navigation: {}
    }
    const stateProps = mapStateToProps(state, props)
    expect(stateProps).toMatchSnapshot()
  })
})

describe('mapDispatchToProps', () => {
  it('creates actions', () => {
    const dispatch = jest.fn()
    const props = {
      route: {
        params: { id: 77 }
      },
      navigation: {
        navigate: jest.fn()
      }
    }
    const dispatchProps = mapDispatchToProps(dispatch, props)
    expect(dispatchProps).toMatchSnapshot()
    dispatchProps.createMessage('some text')
    dispatchProps.fetchMessages(3)
    dispatchProps.reconnectFetchMessages()
    dispatchProps.sendIsTyping()
    dispatchProps.updateThreadReadTime()
    expect(dispatch.mock.calls).toMatchSnapshot()
    dispatchProps.showTopic('topicName')
    dispatchProps.showTopic('topicName')
    expect(props.navigation.navigate.mock.calls).toMatchSnapshot()
  })
})
