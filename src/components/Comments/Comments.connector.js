import { connect } from 'react-redux'
import getMe from '../../store/selectors/getMe'
import { isEmpty } from 'lodash/fp'
import {
  fetchComments,
  getHasMoreComments,
  getTotalComments,
  getComments,
  FETCH_COMMENTS
} from './Comments.store'

export function mapStateToProps (state, props) {

  const pending = props.postPending || state.pending[FETCH_COMMENTS]


  return {
    comments: [], // getComments(state, props),
    total: getTotalComments(state, {id: props.postId}),
    hasMore: getHasMoreComments(state, {id: props.postId}),
    slug: 'hylo',
    currentUser: getMe(state),
    pending: true
  }
}

export const mapDispatchToProps = (dispatch, props) => {
  const { postId } = props
  return {
    fetchCommentsMaker: cursor => () => dispatch(fetchComments(postId, {cursor}))
  }
}

export const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const { comments } = stateProps
  const { fetchCommentsMaker } = dispatchProps
  const cursor = !isEmpty(comments) && comments[0].id
  return {
    ...ownProps,
    ...stateProps,
    ...dispatchProps,
    fetchComments: fetchCommentsMaker(cursor)
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)
