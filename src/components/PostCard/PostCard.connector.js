import { connect } from 'react-redux'
import { push } from 'connected-react-router'
import { postUrl, editPostUrl } from 'util/navigation'
import voteOnPost from 'store/actions/voteOnPost'
import respondToEvent from 'store/actions/respondToEvent'
import getMe from 'store/selectors/getMe'

export function mapStateToProps (state, props) {
  const currentUser = getMe(state)

  return {
    currentUser
  }
}

export function mapDispatchToProps (dispatch, props) {
  const { post, routeParams, querystringParams } = props

  return {
    showDetails: () => dispatch(push(postUrl(post.id, routeParams, querystringParams))),
    editPost: () => dispatch(push(editPostUrl(post.id, routeParams, querystringParams))),
    voteOnPost: () => dispatch(voteOnPost(post.id, !post.myVote)),
    respondToEvent: response => dispatch(respondToEvent(post.id, response))
  }
}

export default connect(mapStateToProps, mapDispatchToProps)
