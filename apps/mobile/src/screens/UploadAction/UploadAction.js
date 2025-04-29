import React, { useEffect, useMemo } from 'react'
import { Alert, View, KeyboardAvoidingView, Platform, TouchableOpacity, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { gql, useQuery } from 'urql'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { get } from 'lodash/fp'
import { AnalyticsEvents } from '@hylo/shared'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import postFieldsFragment from '@hylo/graphql/fragments/postFieldsFragment'
import { postWithCompletionFragment } from '@hylo/graphql/fragments/postFieldsFragment'
import PostPresenter from '@hylo/presenters/PostPresenter'
import mixpanel from 'services/mixpanel'
import useIsModalScreen from 'hooks/useIsModalScreen'
import useRouteParams from 'hooks/useRouteParams'
import Loading from 'components/Loading'
import PostCardForDetails from 'components/PostCard/PostCardForDetails'
import PostCompletion from 'components/PostCompletion'
import FileSelector, { showFilePicker } from '../PostEditor/FileSelector'
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

export default function UploadAction () {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const isModalScreen = useIsModalScreen()
  const { id: postId } = useRouteParams()
  const [{ currentGroup }] = useCurrentGroup()
  const [{ data, fetching, error }] = useQuery({ query: postDetailsQuery, variables: { id: postId } })
  const post = useMemo(() => PostPresenter(data?.post, { forGroupId: currentGroup?.id }), [data?.post, currentGroup?.id])

  const groupId = get('groups.0.id', post)

  const handleShowFilePicker = async () => {
    await showFilePicker({
      upload: () =>{},
      type: 'post',
      id: post?.id,
      onAdd: () =>{},
      onComplete: () =>{},
      onCancel: () =>{}
    })
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className='flex-1'
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableOpacity onPress={handleShowFilePicker}>
        <Text>Touch me</Text>
      </TouchableOpacity>
      {/* <PostCompletion
        post={post}
      /> */}
    </KeyboardAvoidingView>
  )
} 