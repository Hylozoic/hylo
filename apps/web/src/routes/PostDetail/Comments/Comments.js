import React, { useCallback, useEffect, useMemo } from 'react'
import { func, object, string } from 'prop-types'
import { useTranslation } from 'react-i18next'
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

/**
 * Renders the post comment thread for logged-in users.
 * Anonymous viewers only see a commenter count and a login CTA — no comments are fetched or shown.
 */
const Comments = ({
  selectedCommentId,
  post,
  slug,
  commentFormRef,
  scrollToBottom,
  onCommentEditingChange
}) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const selectorProps = useMemo(() => ({ post }), [post])

  const comments = useSelector(state => getComments(state, selectorProps))
  const commentsPending = useSelector(state => state.pending[FETCH_COMMENTS])
  const currentUser = useSelector(getMe)
  const hasMore = useSelector(state => getHasMoreComments(state, { id: post.id }))
  const total = useSelector(state => getTotalComments(state, { id: post.id }))
  const groupIds = useMemo(() => post.groups?.map(g => g.id).filter(Boolean), [post.groups])

  const cursor = comments.length > 0 ? comments[0].id : null

  const fetchComments = useCallback(() => (
    dispatch(fetchCommentsAction(post.id, { cursor }))
  ), [dispatch, post.id, cursor])

  const createComment = useCallback(async commentParams => {
    await dispatch(createCommentAction({ post, ...commentParams }))
    scrollToBottom?.()
  }, [dispatch, post, scrollToBottom])

  useEffect(() => {
    if (!currentUser) return
    if (!selectedCommentId || comments.length === 0 || commentsPending) return
    const allIds = comments.flatMap(c => [c.id, ...c.childComments.map(cc => cc.id)])
    if (!allIds.includes(selectedCommentId.toString())) {
      fetchComments()
    }
  }, [currentUser, selectedCommentId, commentsPending, fetchComments])

  const { ref, width } = useResizeDetector({ handleHeight: false })

  const scrollToReplyInput = (elem) => {
    scrollIntoView(elem, { behavior: 'smooth', scrollMode: 'if-needed' })
  }

  const style = {
    width: width + 'px'
  }

  const loginUrl = `/login?returnToUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`
  const commentersTotal = post.commentersTotal || 0

  // Anonymous: count only + invite login. Do not fetch or render comment bodies.
  if (!currentUser) {
    const countLabel = commentersTotal === 0
      ? t('No comments yet')
      : commentersTotal === 1
        ? t('{{count}} person commented', { count: 1 })
        : t('{{count}} people commented', { count: commentersTotal })

    return (
      <div className={classes.comments} ref={ref} data-testid='comments-login-prompt'>
        <p className='text-center text-foreground/70 text-sm mb-3'>{countLabel}</p>
        <Link
          to={loginUrl}
          target={inIframe() ? '_blank' : ''}
          className={cn(classes.signupButton)}
        >
          {t('Log in to see comments')}
        </Link>
      </div>
    )
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
          onEditingChange={onCommentEditingChange}
        />
      ))}
      <div className={cn('CommentFormWrapper bg-transparent relative bottom-0 w-full px-4 pb-0 z-10')} style={style}>
        <CommentForm
          ref={commentFormRef}
          currentUser={currentUser}
          createComment={createComment}
          groupIds={groupIds}
          postId={post.id}
        />
        <PeopleTyping className={cn(classes.peopleTyping)} />
      </div>
    </div>
  )
}

Comments.propTypes = {
  selectedCommentId: string,
  post: object,
  slug: string,
  commentFormRef: object, // ref object from parent (optional)
  scrollToBottom: func,
  onCommentEditingChange: func
}

export default Comments
