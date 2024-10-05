import { connect } from 'react-redux'
import { get } from 'lodash/fp'
import fetchPerson from 'store/actions/fetchPerson'
import { openURL } from 'hooks/useOpenURL'
import blockUser from 'store/actions/blockUser'
import getMe from 'store/selectors/getMe'
import getPerson from 'store/selectors/getPerson'
import getBlockedUsers from 'store/selectors/getBlockedUsers'
import updateUserSettings from 'store/actions/updateUserSettings'
import getCurrentGroup from 'store/selectors/getCurrentGroup'
import logout from 'store/actions/logout'

export function mapStateToProps (state, props) {
  const currentUser = getMe(state, props)
  const currentGroup = getCurrentGroup(state, props)
  const id = get('route.params.id', props)
  const person = id
    ? getPerson(state, { personId: id })
    : currentUser
  const isMe = Number(get('id', currentUser)) === Number(get('id', person))
  const navigation = props.navigation
  const editing = get('route.params.editing', props)
  const isBlocked = !!getBlockedUsers(state).find(i => get('id', i) === id)
  const goToDetails = () => navigation.navigate('Member Details', { id })
  const goToEdit = () => openURL('/settings')
  const goToEditAccount = () => openURL('/settings/account')
  const goToSkills = () => openURL('/settings')
  const goToManageNotifications = () => openURL('/settings/notifications')
  const goToBlockedUsers = () => openURL('/settings/blocked-users')

  return {
    id,
    isMe,
    isBlocked,
    currentGroup,
    currentUser,
    editing,
    navigation,
    person,
    goToBlockedUsers,
    goToDetails,
    goToEdit,
    goToEditAccount,
    goToManageNotifications,
    goToSkills
  }
}

export const mapDispatchToProps = {
  blockUser,
  fetchPerson,
  logout,
  updateUserSettings
}

export function makeOnPressMessages (currentUser, person, navigation) {
  if (!person || currentUser.id === person.id) return () => navigation.navigate('Messages Tab')

  const { messageThreadId } = person

  if (messageThreadId) return () => navigation.navigate('Messages Tab', { screen: 'Thread', initial: false, params: { id: messageThreadId } })

  return () => navigation.navigate('Messages Tab', { screen: 'New Message', initial: false, params: { participants: person.id } })
}

export function mergeProps (stateProps, dispatchProps, ownProps) {
  const { id, currentUser, person, isMe } = stateProps
  const { navigation } = ownProps

  const fetchPerson = () => dispatchProps.fetchPerson(id)

  const canFlag = currentUser && id && currentUser.id !== id

  const onPressMessages = makeOnPressMessages(currentUser, person, navigation)

  // only call updateUserSettings if isMe (otherwise when you visit another
  // user and then press the back button, you will update your profile with their
  // settings)
  const updateUserSettings = isMe ? dispatchProps.updateUserSettings : () => {}

  const goToMemberProfile = () => navigation.navigate('Member', { id })

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    canFlag,
    fetchPerson,
    goToMemberProfile,
    onPressMessages,
    updateUserSettings
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)
