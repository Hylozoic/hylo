import React, { useEffect, useCallback, useMemo } from 'react'
import { func, object, string } from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { useResizeDetector } from 'react-resize-detector'
import scrollIntoView from 'scroll-into-view-if-needed'
import ShowMore from './ShowMore'
import Comment from './Comment'
import CommentForm from './CommentForm'
import PeopleTyping from 'components/PeopleTyping'
import { cn, inIframe } from 'util/index'
import createCommentAction from 'store/actions/createComment'
import fetchCommentsAction from 'store/actions/fetchComments'
import { FETCH_COMMENTS } from 'store/constants'
import {
  getComments,
  getHasMoreComments,
  getTotalComments
} from 'store/selectors/getComments'
import getMe from 'store/selectors/getMe'

import classes from './Comments.module.scss'

const Comments = ({
  selectedCommentId,
  post,
  slug,
  commentFormRef,
  scrollToBottom
}) => {
  const dispatch = useDispatch()

  const selectorProps = useMemo(() => ({ post }), [post])

  const comments = useSelector(state => getComments(state, selectorProps))
  const commentsPending = useSelector(state => state.pending[FETCH_COMMENTS])
  const currentUser = useSelector(getMe)
  const hasMore = useSelector(state => getHasMoreComments(state, { id: post.id }))
  const total = useSelector(state => getTotalComments(state, { id: post.id }))

  const cursor = comments.length > 0 ? comments[0].id : null

  const fetchComments = useCallback(() => (
    dispatch(fetchCommentsAction(post.id, { cursor }))
  ), [dispatch, post.id, cursor])

  const createComment = useCallback(async commentParams => {
    await dispatch(createCommentAction({ post, ...commentParams }))
    scrollToBottom?.()
  }, [dispatch, post, scrollToBottom])

  const ensureSelectedCommentPresent = useCallback(() => {
    if (selectedCommentId && comments.length > 0) {
      const commentIds = []
      comments.forEach(comment => {
        commentIds.push(comment.id)
        comment.childComments.forEach(comment => commentIds.push(comment.id))
      })
      if (!commentsPending && !commentIds.includes(selectedCommentId.toString())) {
        fetchComments().then(() => {})
      }
    }
  }, [comments, commentsPending, selectedCommentId, fetchComments])

  useEffect(() => {
    ensureSelectedCommentPresent()
  }, [ensureSelectedCommentPresent])

  const { ref, width } = useResizeDetector({ handleHeight: false })

  const scrollToReplyInput = (elem) => {
    scrollIntoView(elem, { behavior: 'smooth', scrollMode: 'if-needed' })
  }

  const style = {
    width: width + 'px'
  }

  return (
    <div className={classes.comments} ref={ref}>
      <ShowMore
        commentsLength={comments.length}
        total={total}
        hasMore={hasMore}
        fetchComments={fetchComments}
      />

      {comments.map(c => (
        <Comment
          key={c.id}
          comment={c}
          slug={slug}
          selectedCommentId={selectedCommentId}
          post={post}
          onReplyThread={scrollToReplyInput}
        />
      ))}
      {currentUser
        ? (
          <div className={cn('CommentFormWrapper bg-transparent relative bottom-0 w-full px-4 pb-0 z-10')} style={style}>
            <CommentForm
              ref={commentFormRef}
              currentUser={currentUser}
              createComment={createComment}
              postId={post.id}
            />
            <PeopleTyping className={cn(classes.peopleTyping)} />
          </div>
          )
        : (
          <Link
            to={`/login?returnToUrl=${encodeURIComponent(window.location.pathname)}`}
            target={inIframe() ? '_blank' : ''}
            className={cn(classes.signupButton)}
          >
            Join Hylo to respond
          </Link>
          )}
    </div>
  )
}

Comments.propTypes = {
  selectedCommentId: string,
  post: object,
  slug: string,
  commentFormRef: object, // ref object from parent (optional)
  scrollToBottom: func
}

export default Comments
