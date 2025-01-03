import { connect } from 'react-redux'
import unBlockUser from 'store/actions/unBlockUser'
import getBlockedUsers from 'store/selectors/getBlockedUsers'

export function mapStateToProps (state, props) {
  return {
    blockedUsers: getBlockedUsers(state)
  }
}

const mapDispatchToProps = {
  unBlockUser
}

export default connect(mapStateToProps, mapDispatchToProps)
