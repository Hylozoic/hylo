import orm from 'store/models'
import { openURL } from 'hooks/useOpenURL'
import { mapStateToProps, makeOnPressMessages, mergeProps } from './MemberProfile.connector'
import { FETCH_PERSON } from 'store/constants'

jest.mock('store/selectors/getCurrentGroupSlug', () => () => 'public')
jest.mock('hooks/useOpenURL', () => {
  const originalModule = jest.requireActual('hooks/useOpenURL')

  return {
    __esModule: true,
    ...originalModule,
    openURL: jest.fn()
  }
})

let ormSession

describe('mapStateToProps', () => {
  beforeAll(() => {
    ormSession = orm.session(orm.getEmptyState())
    ormSession.Me.create({ id: '1' })
  })

  it('maps the state to the props', () => {
    const id = 123
    const route = { params: { id } }
    const navigation = {
      navigate: jest.fn()
    }
    const state = {
      orm: ormSession.state,
      pending: { [FETCH_PERSON]: null }
    }
    const props = mapStateToProps(state, { route, navigation })
    expect(props).toMatchSnapshot()
    props.goToDetails()
    expect(navigation.navigate).toHaveBeenCalledWith('Member Details', { id })
    navigation.navigate.mockClear()
    props.goToEdit()
    expect(openURL).toHaveBeenCalledWith('/settings')
  })
})

describe('makeOnPressMessages', () => {
  let navigation

  beforeEach(() => {
    navigation = {
      navigate: jest.fn()
    }
  })

  it("navigates to thread list when it's your profile", () => {
    const onPressMessages = makeOnPressMessages({ id: 1 }, { id: 1 }, navigation)
    onPressMessages()
    expect(navigation.navigate).toHaveBeenCalledWith('Messages Tab')
  })

  // TODO: Re-write these tests to use a mocked `openURL`
  // it('navigates to existing thread when there is one', () => {
  //   const messageThreadId = 99
  //   const onPressMessages = makeOnPressMessages({ id: 1 }, { id: 2, messageThreadId }, navigation)
  //   onPressMessages()
  //   expect(navigation.navigate).toHaveBeenCalledWith('Messages Tab', { screen: 'Thread', params: { id: messageThreadId } })
  // })

  // it('navigates to new message page when there is no existing thread', () => {
  //   const otherPersonId = 2
  //   const onPressMessages = makeOnPressMessages({ id: 1 }, { id: otherPersonId }, navigation)
  //   onPressMessages()
  //   expect(navigation.navigate).toHaveBeenCalledWith('Messages Tab', { screen: 'New Message', params: { participants: [otherPersonId] } })
  // })
})

describe('mergeProps', () => {
  it('returns the right keys', () => {
    const id = 78
    const stateProps = {
      currentUser: { id: 1 },
      person: { id },
      id,
      isMe: true
    }
    const dispatchProps = {
      fetchPerson: jest.fn(),
      updateUserSettings: jest.fn()
    }
    const ownProps = {
      navigation: {
        navigate: () => {}
      }
    }
    const mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    expect(mergedProps).toMatchSnapshot()
    mergedProps.fetchPerson()
    expect(dispatchProps.fetchPerson).toHaveBeenCalledWith(id)
    const changes = { name: 'bob' }
    mergedProps.updateUserSettings(changes)
    expect(dispatchProps.updateUserSettings).toHaveBeenCalledWith(changes)
  })

  it('sets updateUserSettings to no-op if isMe is false', () => {
    const stateProps = {
      isMe: false
    }
    const dispatchProps = {
      updateUserSettings: jest.fn()
    }
    const mergedProps = mergeProps(stateProps, dispatchProps, {})
    const changes = { name: 'bob' }
    mergedProps.updateUserSettings(changes)
    expect(dispatchProps.updateUserSettings).not.toHaveBeenCalledWith(changes)
  })
})
