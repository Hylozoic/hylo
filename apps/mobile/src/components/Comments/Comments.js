/* eslint-disable camelcase */
import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Text, TouchableOpacity, View, SectionList } from 'react-native'
import { isIOS } from 'util/platform'
import Comment from 'components/Comment'
import Loading from 'components/Loading'
import styles from './Comments.styles'
import { isEmpty, omit } from 'lodash/fp'
import {
  getHasMoreComments,
  getComments,
  getTotalComments
} from 'store/selectors/getComments'
import fetchCommentsAction from 'store/actions/fetchComments'
import { FETCH_COMMENTS } from 'store/constants'

function Comments ({
  postId,
  header: providedHeader = null,
  style = {},
  showMember,
  slug,
  panHandlers,
  onSelect
}, ref) {
  const dispatch = useDispatch()
  const comments = useSelector(state => getComments(state, { postId })) || []
  const pending = useSelector(state => state.pending[FETCH_COMMENTS])
  const sections = comments.map(comment => ({
    comment: omit(['subComments'], comment),
    data: comment.subComments
  }))
  const [highlightedComment, setHighlightedComment] = useState()
  const commentsListRef = useRef()

  const scrollToComment = useCallback((comment, viewPosition = 0.2) => {
    const parentCommentId = comment.parentComment || comment.id
    const subCommentId = comment.parentComment ? comment.id : null
    const section = sections.find(s => parentCommentId === s.comment.id)
    const sectionIndex = section.comment.sectionIndex
    const itemIndex = section.data.find(subComment =>
      subCommentId === subComment.id)?.itemIndex || section.data.length + 1
    commentsListRef?.current.scrollToLocation({ sectionIndex, itemIndex, viewPosition })
  }, [sections])

  const selectComment = useCallback(comment => {
    setHighlightedComment(comment)
    scrollToComment(comment)
    onSelect(comment)
  }, [setHighlightedComment, scrollToComment, onSelect])

  useImperativeHandle(ref, () => ({
    setHighlightedComment,
    scrollToComment,
    clearHighlightedComment: () => setHighlightedComment(null)
  }), [setHighlightedComment, scrollToComment])

  useEffect(() => {
    dispatch(fetchCommentsAction({ postId }))
  }, [dispatch, postId])

  const Header = () => (
    <>
      {providedHeader}
      <ShowMore postId={postId} />
      {pending && (
        <View style={styles.loadingContainer}>
          <Loading style={styles.loading} />
        </View>
      )}
    </>
  )

  const SectionFooter = ({ section: { comment } }) => {
    return (
      <>
        <ShowMore commentId={comment.id} style={styles.subCommentsShowMore} forSubcomments />
        <Comment
          clearHighlighted={() => setHighlightedComment(null)}
          comment={comment}
          highlighted={comment.id === highlightedComment?.id}
          onReply={selectComment}
          scrollTo={viewPosition => scrollToComment(comment, viewPosition)}
          setHighlighted={() => setHighlightedComment(comment)}
          showMember={showMember}
          slug={slug}
          key={comment.id}
        />
      </>
    )
  }

  const Item = ({ item: comment }) => {
    return (
      <Comment
        clearHighlighted={() => setHighlightedComment(null)}
        comment={comment}
        highlighted={comment.id === highlightedComment?.id}
        onReply={selectComment}
        scrollTo={viewPosition => scrollToComment(comment, viewPosition)}
        setHighlighted={() => setHighlightedComment(comment)}
        showMember={showMember}
        slug={slug}
        style={styles.subComment}
        key={comment.id}
      />
    )
  }

  return (
    <SectionList
      style={style}
      contentContainerStyle={styles.contentContainerStyle}
      ref={commentsListRef}
      // Footer is Header, etc.
      inverted
      ListFooterComponent={Header}
      renderSectionFooter={SectionFooter}
      renderItem={Item}
      sections={sections}
      keyExtractor={comment => comment.id}
      initialScrollIndex={0}
      // keyboardShouldPersistTaps='handled'
      keyboardShouldPersistTaps='never'
      keyboardDismissMode={isIOS ? 'interactive' : 'on-drag'}
      {...panHandlers}
    />
  )
}

export default forwardRef(Comments)

export function ShowMore ({ postId, commentId, forSubcomments = false, style = {} }) {
  const queryParams = commentId ? { commentId } : { postId }
  const dispatch = useDispatch()
  const fetchComments = () => dispatch(fetchCommentsAction(queryParams, { cursor }))
  const comments = useSelector(state => getComments(state, queryParams)) || []
  const cursor = !isEmpty(comments) && comments[comments.length - 1].id
  const total = useSelector(state => getTotalComments(state, queryParams)) || 0
  const hasMore = useSelector(state => getHasMoreComments(state, queryParams))
  const extra = total - comments.length

  if (!hasMore || extra < 1) return null

  return (
    <TouchableOpacity>
      <Text style={[styles.showMore, style]} onPress={fetchComments}>
        View {extra} previous {forSubcomments ? 'replies' : `comment${extra > 1 ? 's' : ''}`}
      </Text>
    </TouchableOpacity>
  )
}
