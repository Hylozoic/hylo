import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Loading from 'components/Loading'
import CommentCard from 'components/CommentCard'
import isPendingFor from 'store/selectors/isPendingFor'
import {
  getMemberComments,
  fetchMemberComments,
  FETCH_MEMBER_COMMENTS
} from './MemberComments.store'
import classes from './MemberComments.module.scss'

export default function MemberComments ({ routeParams = {}, loading: loadingProp }) {
  const dispatch = useDispatch()
  const comments = useSelector(state => getMemberComments(state, { routeParams }))
  const loadingFromStore = useSelector(state => isPendingFor(FETCH_MEMBER_COMMENTS, state))
  const loading = loadingProp ?? loadingFromStore

  useEffect(() => {
    dispatch(fetchMemberComments(routeParams.personId))
  }, [dispatch, routeParams.personId])

  const itemSelected = selectedItemId => selectedItemId === routeParams.postId

  if (loading) return <Loading />

  return (
    <div>
      {comments && comments.map(comment =>
        <div className={classes.activityItem} key={comment.id}>
          <CommentCard
            comment={comment}
            routeParams={routeParams}
            expanded={itemSelected(comment.post.id)}
          />
        </div>
      )}
    </div>
  )
}
