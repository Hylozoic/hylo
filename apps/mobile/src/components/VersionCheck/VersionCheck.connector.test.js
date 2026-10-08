import { mapDispatchToProps } from './VersionCheck.connector.js'
import { Alert } from 'react-native'
import { CHECK_VERSION } from './actions'

jest.mock('react-native-device-info', () => {
  return {
    default: {
      getVersion: jest.fn()
    },
    getVersion: jest.fn(() => '2.0')
  }
})

beforeEach(() => {
  jest.spyOn(Alert, 'alert')
})

afterEach(() => {
  Alert.alert.mockReset()
})

function mockDispatch (updateType) {
  return jest.fn(action => {
    expect(action.type).toEqual(CHECK_VERSION)
    return Promise.resolve({ payload: updateType })
  })
}

it('alerts with a forced version update', async () => {
  const dispatch = mockDispatch({
    type: 'force',
    title: 'Force title',
    message: 'Force message'
  })
  const { checkVersion } = mapDispatchToProps(dispatch)
  await checkVersion()
  expect(Alert.alert).toBeCalled()
  expect(Alert.alert.mock.calls).toMatchSnapshot()
})

it('alerts with a suggested version update', async () => {
  const dispatch = mockDispatch({
    type: 'suggest',
    title: 'Suggest title',
    message: 'Suggest message'
  })
  const { checkVersion } = mapDispatchToProps(dispatch)
  await checkVersion()
  expect(Alert.alert).toBeCalled()
  expect(Alert.alert.mock.calls).toMatchSnapshot()
})

it('does not alert if there is no update data', async () => {
  const dispatch = mockDispatch()
  const { checkVersion } = mapDispatchToProps(dispatch)
  await checkVersion()
  expect(Alert.alert).not.toBeCalled()
})

it('does not alert if the update data has no type', async () => {
  const dispatch = mockDispatch()
  const { checkVersion } = mapDispatchToProps(dispatch)
  await checkVersion()
  expect(Alert.alert).not.toBeCalled()
})
