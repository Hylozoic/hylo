import React, { useEffect, useCallback } from 'react'
import { array, bool, func, object, number, string } from 'prop-types'
import { Link } from 'react-router-dom'
import { useResizeDetector } from 'react-resize-detector'
import scrollIntoView from 'scroll-into-view-if-needed'
import ShowMore from './ShowMore'
import Comment from './Comment'
import CommentForm from './CommentForm'
import PeopleTyping from 'components/PeopleTyping'
import { cn, inIframe } from 'util/index'

import classes from './Comments.module.scss'

const Comments = ({
  comments = [],
  commentsPending,
  selectedCommentId,
  fetchComments,
  createComment,
  currentUser,
  post,
  slug,
  total,
  hasMore
}) => {
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
  comments: array,
  commentsPending: object,
  selectedCommentId: string,
  fetchComments: func,
  createComment: func,
  currentUser: object,
  post: object,
  slug: string,
  total: number,
  hasMore: bool
}

export default Comments
