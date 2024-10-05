import { connect } from 'react-redux'
import getMe from 'store/selectors/getMe'
import { isEmpty } from 'lodash/fp'
import {
  getHasMoreComments,
  getComments,
  getTotalComments
} from 'store/selectors/getComments'
import fetchComments from 'store/actions/fetchComments'
import { FETCH_COMMENTS } from 'store/constants'

export function mapStateToProps (state, props) {
  const { commentId, postId } = props
  // Get Comments from queryCache as either
  // children of a Post or another Comment
  const queryCacheParams = {}

  if (commentId) queryCacheParams.commentId = commentId
  if (postId) queryCacheParams.postId = postId

  return {
    queryCacheParams,
    comments: getComments(state, queryCacheParams),
    total: getTotalComments(state, queryCacheParams),
    hasMore: getHasMoreComments(state, queryCacheParams),
    currentUser: getMe(state),
    pending: state.pending[FETCH_COMMENTS]
  }
}

export const mapDispatchToProps = {
  fetchComments
}

export const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const { comments, queryCacheParams } = stateProps
  const cursor = !isEmpty(comments) && comments[comments.length - 1].id
  const fetchComments = () => dispatchProps.fetchComments(queryCacheParams, { cursor })

  return {
    ...ownProps,
    ...stateProps,
    ...dispatchProps,
    fetchComments
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps, { forwardRef: true })
