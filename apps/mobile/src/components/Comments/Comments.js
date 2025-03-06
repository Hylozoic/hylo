/* eslint-disable camelcase */
import React, { useState, useRef, useImperativeHandle, useCallback } from 'react'
import { Text, TouchableOpacity, View, SectionList } from 'react-native'
import { useQuery } from 'urql'
import { isIOS } from 'util/platform'
import postCommentsQuery from '@hylo/graphql/queries/postCommentsQuery'
import childCommentsQuery from '@hylo/graphql/queries/childCommentsQuery'
import Comment from 'components/Comment'
import Loading from 'components/Loading'
import styles from './Comments.styles'

export const Comments = React.forwardRef(({
  groupId,
  postId,
  header: providedHeader = null,
  style = {},
  showMember,
  panHandlers,
  onSelect
}, ref) => {
  const [{ data, fetching }] = useQuery({ query: postCommentsQuery, variables: { postId } })
  const post = data?.post
  const commentsQuerySet = post?.comments
  const comments = commentsQuerySet?.items || []

  const [highlightedComment, setHighlightedComment] = useState()
  const commentsListRef = useRef()
  const sections = comments?.map((comment, index) => {
    return ({
      comment,
      data: comment?.childComments?.items || []
    })
  })

  const scrollToComment = useCallback((comment, viewPosition = 0.2) => {
    const parentCommentId = comment.parentComment?.id || comment.id
    const childCommentId = comment.parentComment ? comment.id : null
    const parentCommentIndex = sections.findIndex(s => parentCommentId === s.comment.id)
    const childCommentIndex = sections[parentCommentIndex].data.findIndex(childComment => childCommentId === childComment.id)
    const hasChildComments = sections[parentCommentIndex].data.length > 0
    const lastItemIndex = sections[parentCommentIndex].data.length - 1

    // NOTE: The logic below is a bit convoluted due to inverted SectionList, but it works.
    let itemIndex
    if (childCommentId) {
      itemIndex = childCommentIndex + 1
    } else if (hasChildComments && !childCommentId) {
      itemIndex = lastItemIndex + 1
    } else {
      itemIndex = 1
    }

    commentsListRef?.current.scrollToLocation({
      sectionIndex: parentCommentIndex === -1 ? 0 : parentCommentIndex,
      itemIndex,
      viewPosition
    })
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

  // Comment rendering (parent)
  const Header = () => (
    <>
      {providedHeader}
      <ShowMore postOrComment={post} style={styles.childCommentsShowMore} />
      {fetching && (
        <View style={styles.loadingContainer}>
          <Loading style={styles.loading} />
        </View>
      )}
    </>
  )

  // Comment rendering (parent)
  const SectionFooter = ({ section: { comment } }) => {
    if (!comment) return null
    return (
      <>
        <ShowMore postOrComment={comment} style={styles.childCommentsShowMore} />
        <Comment
          clearHighlighted={() => setHighlightedComment(null)}
          comment={comment}
          groupId={groupId}
          highlighted={comment?.id === highlightedComment?.id}
          onReply={selectComment}
          postTitle={post?.title}
          scrollTo={viewPosition => scrollToComment(comment, viewPosition)}
          setHighlighted={() => setHighlightedComment(comment)}
          showMember={showMember}
          key={comment.id}
        />
      </>
    )
  }

  // comment.childComments rendering
  const Item = ({ item: comment }) => {
    if (!comment) return null
    return (
      <Comment
        clearHighlighted={() => setHighlightedComment(null)}
        comment={comment}
        groupId={groupId}
        highlighted={comment.id === highlightedComment?.id}
        onReply={selectComment}
        postTitle={post?.title}
        scrollTo={viewPosition => scrollToComment(comment, viewPosition)}
        setHighlighted={() => setHighlightedComment(comment)}
        showMember={showMember}
        style={styles.childComment}
        key={comment.id}
      />
    )
  }

  if (fetching) {
    return <Loading />
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
})

export function ShowMore ({ postOrComment, style = {} }) {
  const forSubcomments = !!postOrComment?.childComments
  const commentQuerySet = forSubcomments
    ? postOrComment?.childComments
    : postOrComment?.comments
  const cursor = commentQuerySet?.items[commentQuerySet?.items.length - 1]?.id
  const variables = forSubcomments
    ? { commentId: postOrComment?.id, cursor }
    : { postId: postOrComment?.id, cursor }
  const query = forSubcomments ? childCommentsQuery : postCommentsQuery
  const [, fetchComments] = useQuery({ query, variables, pause: true })
  const total = commentQuerySet?.total || 0
  const hasMore = commentQuerySet?.hasMore
  const extra = total - commentQuerySet?.items?.length || 0

  if (!hasMore) return null

  return (
    <TouchableOpacity>
      <Text style={[styles.showMore, style]} onPress={() => fetchComments()}>
        View {extra > 0 ? extra : ''} previous {forSubcomments ? 'replies' : `comment${extra > 1 ? 's' : ''}`}
      </Text>
    </TouchableOpacity>
  )
}

export default Comments
