import { mapStateToProps, mergeProps } from './ThreadList.connector'

jest.mock('store/selectors/getMe', () => () => {})

test('mapStateToProps', () => {
  const state = {
    pending: {},
    queryResults: {},
    SocketListener: {
      connected: true
    }
  }
  const props = {}
  expect(mapStateToProps(state, props)).toMatchSnapshot()
})

test('mergeProps', () => {
  const dispatchProps = {
    fetchThreads: jest.fn(),
    updateLastViewed: jest.fn()

  }
  const { fetchThreads } = mergeProps({}, dispatchProps, {})
  fetchThreads()
  expect(dispatchProps.fetchThreads).toHaveBeenCalledWith(10)
  expect(dispatchProps.updateLastViewed).toHaveBeenCalled()
})
