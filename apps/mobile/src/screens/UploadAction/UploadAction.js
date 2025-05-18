import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { Alert, View, KeyboardAvoidingView, Platform, TouchableOpacity, Text, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { gql, useQuery, useMutation } from 'urql'
import { Upload, Check } from 'lucide-react-native'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'
import { get } from 'lodash/fp'

import { AnalyticsEvents, TextHelpers } from '@hylo/shared'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import postFieldsFragment from '@hylo/graphql/fragments/postFieldsFragment'
import { postWithCompletionFragment } from '@hylo/graphql/fragments/postFieldsFragment'
import completePostMutation from '@hylo/graphql/mutations/completePostMutation'
import PostPresenter from '@hylo/presenters/PostPresenter'
import { getTrackIdFromPath } from '@hylo/navigation'
import useIsModalScreen from 'hooks/useIsModalScreen'
import useRouteParams from 'hooks/useRouteParams'
import { isIOS } from 'util/platform'
import mixpanel from 'services/mixpanel'
import Loading from 'components/Loading'
import PostBody from 'components/PostCard/PostBody'
import FileSelector, { showFilePicker } from '../PostEditor/FileSelector'
import uploadAction from 'store/actions/upload'
import { usePostEditorStore } from '../PostEditor/PostEditor.store'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useTrack from '@hylo/hooks/useTrack'
import { useToast } from 'components/Toast'

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
  const { id: postId, originalLinkingPath } = useRouteParams()
  const trackId = getTrackIdFromPath(originalLinkingPath)
  const [{ currentGroup }] = useCurrentGroup()
  const [{ data, fetching, error }] = useQuery({ query: postDetailsQuery, variables: { id: postId } })
  const dispatch = useDispatch()
  const upload = useCallback((...params) => dispatch(uploadAction(...params)), [dispatch])
  const [filePickerPending, setFilePickerPending] = useState(false)
  const [completionResponse, setCompletionResponse] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const { completionAction, completionActionSettings } = data?.post || {}
  const { instructions, options } = completionActionSettings || {}
  const { 
    post,
    updatePost,
    addAttachment,
    removeAttachment
  } = usePostEditorStore()

  const [, completePost] = useMutation(completePostMutation)
  const [{ currentUser }] = useCurrentUser()
  const showToast = useToast()
  const [currentTrack, trackQueryInfo, refetchTrack] = useTrack({ trackId })

  // Initialize the post store with the fetched post data
  useEffect(() => {
    if (data?.post) {
      updatePost(data.post)
    }
  }, [data?.post])

  const handleFileChoice = ({ local, remote }) => {
    if (remote) {
      setCompletionResponse(prev => [...prev, { url: remote, localUri: local }])
    }
  }

  const handleAttachmentUploadError = (type, errorMessage, attachment) => {
    removeAttachment(type, attachment)
    Alert.alert(errorMessage)
  }

  const handleShowFilePicker = async () => {
    setFilePickerPending(true)
    try {
      await showFilePicker({
        upload,
        type: 'post',
        id: post?.id,
        onAdd: (attachment) => {
          addAttachment('file', attachment)
          handleFileChoice(attachment)
        },
        onError: (errorMessage, attachment) => {
          setFilePickerPending(false)
          handleAttachmentUploadError('file', errorMessage, attachment)
        },
        onComplete: () => {
          setFilePickerPending(false)
        },
        onCancel: () => {
          setFilePickerPending(false)
        }
      })
    } catch (error) {
      console.error('ShowFilePicker error:', error)
      setFilePickerPending(false)
      Alert.alert(t('Error uploading file'), error.message)
    }
  }

  const handleSubmitCompletion = async () => {
    setSubmitting(true)
    try {
      const { data, error } = await completePost({
        postId: post.id,
        completionResponse
      })

      if (error) {
        console.error('Error completing post', error)
        showToast({
          type: 'error',
          text1: t('Error completing action'),
          text2: error.message
        })
        return
      }

      const completedPost = data.completePost
      if (completedPost) {
        const allActionsCompleted = currentTrack.posts.every(
          action => action.id === post.id || action.completedAt
        )

        if (allActionsCompleted) {
          refetchTrack()
          showToast({
            type: 'success',
            text1: t('You have completed') + ':',
            text2: currentTrack.name,
            visibilityTime: 3000
          })
        } else {
          showToast({
            type: 'success',
            text1: t('Files uploaded')
          })
        }

        navigation.goBack()
      }
    } catch (error) {
      console.error('Error completing post', error)
      showToast({
        type: 'error',
        text1: t('Error uploading'),
        text2: error.message
      })
    } finally {
      setSubmitting(false)
    }
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
  const attachmentsLoading = post.getAttachments().some(attachment => !attachment?.url)
  const files = post.getFiles()

  if (post?.completedAt) {
    const completedAt = post.completedAt ? TextHelpers.formatDatePair(post.completedAt) : null
    return (
      <View className='p-4 bg-background-plus rounded-lg mb-4'>
        <View className='flex-row items-center'>
          <Check className='w-5 h-5 text-success mr-2' />
          <Text className='text-foreground font-medium'>
            {t('You completed this action {{date}}', { date: completedAt })}
          </Text>
        </View>
        <FileSelector
          onRemove={attachment => removeAttachment('file', attachment)}
          files={post.getFiles()}
        />
      </View>
    )
  }

  return (
    <SafeAreaView className='flex-1 bg-background'>
      <ScrollView className='flex-1 p-4'>
        <View className='p-4 bg-background-plus rounded-lg mb-4'>
          <Text className='text-foreground font-medium mb-4'>{t('Upload Files')}</Text>
          {post.completionActionSettings?.instructions && (
            <Text className='font-bold mb-4'>{post.completionActionSettings.instructions}</Text>
          )}

          <FileSelector
            files={completionResponse}
            onChange={setCompletionResponse}
            onUpload={upload}
          />

          {completionResponse.length === 0 ? (
            <TouchableOpacity
              onPress={handleShowFilePicker}
              disabled={filePickerPending}
              className={`mt-4 p-3 rounded-lg ${filePickerPending ? 'bg-background' : 'bg-primary'}`}
            >
              <Text
                className={`text-center font-medium ${
                  filePickerPending ? 'text-foreground-muted' : 'text-primary-foreground'
                }`}
              >
                {filePickerPending ? t('Uploading files please wait') + '...' : t('Upload Files')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSubmitCompletion}
              disabled={submitting}
              className={`mt-4 p-3 rounded-lg ${submitting ? 'bg-background' : 'bg-primary'}`}
            >
              <Text
                className={`text-center font-medium ${
                  submitting ? 'text-foreground-muted' : 'text-primary-foreground'
                }`}
              >
                {submitting ? t('Submitting') + '...' : t('Submit Files and Complete')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
} 