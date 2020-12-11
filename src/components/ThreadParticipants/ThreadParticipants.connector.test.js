import { mapStateToProps } from './ThreadParticipants.connector'

describe('mapStateToProps', () => {
  it('returns the right keys', () => {
    const props = {
      route: {
        params: { id: 1 }
      },
      navigation: {
        navigate: jest.fn()
      }
    }
    const stateProps = mapStateToProps({}, props)
    expect(stateProps).toMatchSnapshot()
    stateProps.goToParticipant(1)
    expect(props.navigation.navigate).toHaveBeenCalledWith('MemberProfile', { id: 1 })
  })
})
