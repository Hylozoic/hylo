import { mapStateToProps } from './BlockedUsers.connector'

jest.mock('store/selectors/getMe', () => () => {})

describe('mapStateToProps', () => {
  it('matches last snapshot', () => {
    const stateProps = mapStateToProps({}, {})
    expect(stateProps).toMatchSnapshot()
  })
})
