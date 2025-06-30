import React, { useEffect, useMemo, useState } from 'react'
import { Alert, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { gql, useQuery, useSubscription } from 'urql'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { get } from 'lodash/fp'
import { AnalyticsEvents } from '@hylo/shared'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import postFieldsFragment from '@hylo/graphql/fragments/postFieldsFragment'
import { postWithCompletionFragment } from '@hylo/graphql/fragments/postFieldsFragment'
import commentFieldsFragment from '@hylo/graphql/fragments/commentFieldsFragment'
import PostPresenter from '@hylo/presenters/PostPresenter'
import { getTrackIdFromPath } from '@hylo/navigation'
import mixpanel from 'services/mixpanel'
import useGoToMember from 'hooks/useGoToMember'
import useIsModalScreen from 'hooks/useIsModalScreen'
import useRouteParams from 'hooks/useRouteParams'
import CommentEditor from 'components/CommentEditor'
import Comments from 'components/Comments'
import Loading from 'components/Loading'
import PostCardForDetails from 'components/PostCard/PostCardForDetails'
import ActionCompletionSection from 'components/ActionCompletionSection'
import { isIOS } from 'util/platform'

export const postDetailsQuery = gql`
  query PostDetailsQuery ($id: ID) {
    post(id: $id) {
      ...PostFieldsFragment
      ...PostWithCompletionFragment
    }
  }
  ${postFieldsFragment}
  ${postWithCompletionFragment}
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
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const isModalScreen = useIsModalScreen()
  const { id: postId, originalLinkingPath, commentId } = useRouteParams()
  const [{ currentGroup }] = useCurrentGroup()
  const [{ data, fetching, error }] = useQuery({ query: postDetailsQuery, variables: { id: postId } })
  const post = useMemo(() => PostPresenter(data?.post, { forGroupId: currentGroup?.id }), [data?.post, currentGroup?.id])
  const commentsRef = React.useRef()
  const goToMember = useGoToMember()
  const trackId = post?.type === 'action' ? getTrackIdFromPath(originalLinkingPath) : null
  useSubscription({
    query: commentsSubscription,
    variables: { postId: post?.id },
    pause: !post?.id
  })
  console.log('commentId sdsds', commentId)
  const [selectedComment, setSelectedComment] = useState()
  const groupId = get('groups.0.id', post)

  const clearSelectedComment = () => {
    setSelectedComment(null)
    commentsRef.current && commentsRef.current.clearHighlightedComment()
  }

  const scrollToSelectedComment = () => {
    commentsRef.current && commentsRef.current.scrollToComment(selectedComment)
  }

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

  const firstGroupSlug = get('groups.0.slug', post)
  const showGroups = isModalScreen || post?.groups.find(g => g.slug !== currentGroup?.slug)

  return (
    <View 
      className='flex-1'
      style={{ 
        paddingTop: 10,
        paddingBottom: 10
      }}
    >
      <Comments
        ref={commentsRef}
        groupId={firstGroupSlug}
        postId={post.id}
        commentIdFromPath={commentId}
        header={(
          <>
            <PostCardForDetails
              post={post}
              showGroups={showGroups}
              groupId={groupId}
            />
            {post.type === 'action' && post.completionAction && (
              <ActionCompletionSection
                post={post}
                trackId={trackId}
              />
            )}
          </>
        )}
        onSelect={setSelectedComment}
        showMember={goToMember}
      />
      <CommentEditor
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
