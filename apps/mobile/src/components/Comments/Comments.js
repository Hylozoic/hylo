/* eslint-disable camelcase */
import React, { useState, useRef, useImperativeHandle, useCallback } from 'react'
import { Dimensions, Text, TouchableOpacity, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
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
  showMember,
  panHandlers,
  onSelect
}, ref) => {
  const commentsListRef = useRef()
  const [{ data, fetching }] = useQuery({ query: postCommentsQuery, variables: { postId } })
  const post = data?.post
  const commentsQuerySet = post?.comments
  const comments = commentsQuerySet?.items || []
  const [highlightedComment, setHighlightedComment] = useState()

  const scrollToComment = useCallback((comment, viewPosition = 0.2) => {
    const parentCommentId = comment?.parentComment?.id || comment.id
    const parentCommentIndex = comments.findIndex(comment => parentCommentId === comment.id)

    commentsListRef?.current.scrollToIndex({
      index: parentCommentIndex === -1 ? 0 : parentCommentIndex,
      viewPosition
    })
  }, [comments])

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

  const renderItem = ({ item: comment }) => {
    if (!comment) return null
    // Inverted flat list so comments will render in reverse order, but child comments
    // here will not, and the query is setup to query in desc order. Could be changed to "asc"
    // but going to keep it has been for now.
    const reversedChildComments = [...comment.childComments.items].reverse()
    return (
      <>
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
          key={comment.id}
        />
        <ShowMore postOrComment={comment} style={styles.childCommentsShowMore} />
        {reversedChildComments.map(childComment => (
          <Comment
            clearHighlighted={() => setHighlightedComment(null)}
            comment={childComment}
            groupId={groupId}
            highlighted={childComment.id === highlightedComment?.id}
            onReply={selectComment}
            postTitle={post?.title}
            scrollTo={viewPosition => scrollToComment(childComment, viewPosition)}
            setHighlighted={() => setHighlightedComment(childComment)}
            showMember={showMember}
            style={styles.childComment}
            key={childComment.id}
          />
        ))}
      </>
    )
  }

  if (fetching) {
    return <Loading />
  }

  return (
    <FlashList
      ref={commentsListRef}
      // TODO: Make height fill screen so it starts at top when content size is < screen size.
      // Haven't been able to arrive at a solution yet, but the below methods are the keys to
      // getting there. The fallback to to use a FlatList here again instead of FlashList, as we
      // previously had a functioning hack for FlatList for this case.
      // onLoad={() => {}}
      // onLayout={({ nativeEvent }) => { nativeEvent.layout.height }}
      // onContentSizeChange={(width, height) => {}}
      // Footer is Header, etc.
      inverted
      ListFooterComponent={Header}
      renderItem={renderItem}
      data={comments}
      // This means that FlashList will re-render anytime this/these values change
      extraData={highlightedComment}
      estimatedItemSize={100}
      estimatedListSize={Dimensions.get('screen')}
      keyExtractor={comment => comment.id}
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
