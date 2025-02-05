import React, { useEffect, useMemo, useState } from 'react'
import { View, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { gql, useQuery, useSubscription } from 'urql'
import { useTranslation } from 'react-i18next'
import { get } from 'lodash/fp'
import { AnalyticsEvents } from '@hylo/shared'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import mixpanel from 'services/mixpanel'
import useGoToMember from 'hooks/useGoToMember'
import useIsModalScreen from 'hooks/useIsModalScreen'
import useRouteParams from 'hooks/useRouteParams'
import postFieldsFragment from '@hylo/graphql/fragments/postFieldsFragment'
import commentFieldsFragment from '@hylo/graphql/fragments/commentFieldsFragment'
import PostPresenter from '@hylo/presenters/PostPresenter'
import { KeyboardAccessoryCommentEditor } from 'components/CommentEditor/CommentEditor'
import Comments from 'components/Comments'
import Loading from 'components/Loading'
import PostCardForDetails from 'components/PostCard/PostCardForDetails'
import { white } from 'style/colors'

export const postDetailsQuery = gql`
  query PostDetailsQuery ($id: ID) {
    post(id: $id) {
      ...PostFieldsFragment
    }
  }
  ${postFieldsFragment}
`

export const commentsSubscription = gql`
  subscription CommentSubscription($postId: ID!) {
    comments(postId: $postId) {
      ...CommentFieldsFragment
    }
  }
  ${commentFieldsFragment}
`

export default function PostDetails () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const isModalScreen = useIsModalScreen()
  const { id: postId } = useRouteParams()
  const [{ currentGroup }] = useCurrentGroup()
  const [{ data, fetching, error }] = useQuery({ query: postDetailsQuery, variables: { id: postId } })
  const post = useMemo(() => PostPresenter(data?.post, currentGroup?.id), [data?.post, currentGroup?.id])
  const commentsRef = React.useRef()
  const goToMember = useGoToMember()

  useSubscription({
    query: commentsSubscription,
    variables: { postId: post?.id },
    pause: !post?.id
  })

  const [selectedComment, setSelectedComment] = useState(null)
  const groupId = get('groups.0.id', post)

  const setHeader = () => {
    !isModalScreen && navigation.setOptions({ title: currentGroup?.name })
  }
  const clearSelectedComment = () => {
    setSelectedComment(null)
    commentsRef.current && commentsRef.current.clearHighlightedComment()
  }

  const scrollToSelectedComment = () => {
    commentsRef.current && commentsRef.current.scrollToComment(selectedComment)
  }

  useEffect(() => { setHeader() }, [currentGroup?.slug])

  useEffect(() => {
    if (!fetching && !error && post) {
      mixpanel.track(AnalyticsEvents.POST_OPENED, {
        postId: post?.id,
        groupId: post.groups.map(g => g.id),
        isPublic: post.isPublic,
        topics: post.topics?.map(t => t.name),
        type: post.type
      })
    }
  }, [fetching, error, post])

  if (fetching) return <Loading />

  if (error) {
    Alert.alert(
      t('Sorry, we couldn\'t find that post'),
      t('It may have been removed, or you don\'t have permission to view it'),
      [{ text: t('Ok'), onPress: () => navigation.replace('Stream') }]
    )
    return null
  }

  const renderPostDetails = panHandlers => {
    // TOOD: It is not clear why we do this vs just relying on currentGroup
    const firstGroupSlug = get('groups.0.slug', post)
    const showGroups = isModalScreen || post?.groups.find(g => g.slug !== currentGroup?.slug)

    return (
      <Comments
        ref={commentsRef}
        groupId={firstGroupSlug}
        postId={post.id}
        header={(
          <PostCardForDetails
            post={post}
            showGroups={showGroups}
            groupId={groupId}
          />
        )}
        onSelect={setSelectedComment}
        showMember={goToMember}
        panHandlers={panHandlers}
      />
    )
  }

  return (
    <View style={styles.container}>
      <KeyboardAccessoryCommentEditor
        renderScrollable={renderPostDetails}
        isModal={isModalScreen}
        post={post}
        groupId={groupId}
        replyingTo={selectedComment}
        scrollToReplyingTo={scrollToSelectedComment}
        clearReplyingTo={clearSelectedComment}
      />
    </View>
  )
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: white
  }
}
