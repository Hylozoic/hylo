import { mapStateToProps, mapDispatchToProps, mergeProps } from './SocketListener.connector'
import orm from 'store/models'
import timezoneMock from 'timezone-mock'

let createdAt, message

beforeAll(() => {
  createdAt = '2017-10-11'
  message = {
    id: '1',
    text: 'hi',
    createdAt
  }
  timezoneMock.register('US/Pacific')
})

afterAll(() => timezoneMock.unregister())

it('returns the expected value', () => {
  const session = orm.session(orm.getEmptyState())
  session.Group.create({ id: '7' })
  const state = { session: { groupId: '7' }, orm: session.state }
  const props = {}
  const stateProps = mapStateToProps(state, props)
  const dispatch = jest.fn(value => value)
  const dispatchProps = mapDispatchToProps(dispatch, props)
  const mergedProps = mergeProps(stateProps, dispatchProps)

  expect(mergedProps).toMatchSnapshot()

  const {
    addUserTyping,
    clearUserTyping,
    receiveComment,
    receiveMessage,
    receiveNotification,
    receivePost,
    receiveThread
  } = mergedProps

  expect(addUserTyping('11', 'Joe')).toMatchSnapshot()
  expect(clearUserTyping('11')).toMatchSnapshot()
  expect(receiveComment({ id: '1', text: 'hi' })).toMatchSnapshot()
  expect(receiveMessage(message)).toMatchSnapshot()
  expect(receiveNotification({ id: '1', text: 'hi' })).toMatchSnapshot()
  expect(receivePost({ id: '1', title: 'hi' })).toMatchSnapshot()
  expect(receiveThread({
    id: '1',
    createdAt,
    updatedAt: createdAt,
    messages: [message]
  })).toMatchSnapshot()
})
