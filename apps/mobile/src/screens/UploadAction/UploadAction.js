import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { Alert, View, KeyboardAvoidingView, Platform, TouchableOpacity, Text, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { gql, useQuery, useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { get } from 'lodash/fp'
import { AnalyticsEvents } from '@hylo/shared'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import postFieldsFragment from '@hylo/graphql/fragments/postFieldsFragment'
import { postWithCompletionFragment } from '@hylo/graphql/fragments/postFieldsFragment'
import completePostMutation from '@hylo/graphql/mutations/completePostMutation'
import PostPresenter from '@hylo/presenters/PostPresenter'
import mixpanel from 'services/mixpanel'
import useIsModalScreen from 'hooks/useIsModalScreen'
import useRouteParams from 'hooks/useRouteParams'
import Loading from 'components/Loading'
import PostBody from 'components/PostCard/PostBody'
import FileSelector, { showFilePicker } from '../PostEditor/FileSelector'
import { Upload, Check } from 'lucide-react-native'
import { isIOS } from 'util/platform'
import { useDispatch } from 'react-redux'
import uploadAction from 'store/actions/upload'
import { usePostEditorStore } from '../PostEditor/PostEditor.store'
import useCurrentUser from '@hylo/hooks/useCurrentUser'

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

  // Initialize the editor post with the fetched post data
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

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const { data, error } = await completePost({
        postId: post.id,
        completionResponse
      })

      if (error) {
        console.error('Error completing post', error)
        Alert.alert(t('Error completing post'), error.message)
        return
      }

      const completedPost = data.completePost
      if (completedPost) {
        Alert.alert(t('Success'), t('Post completed successfully'))
      }
    } catch (error) {
      console.error('Error completing post', error)
      Alert.alert(t('Error completing post'), error.message)
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
    return (
      <View className='p-4 bg-background-plus rounded-lg mb-4'>
        <View className='flex-row items-center'>
          <Check className='w-5 h-5 text-success mr-2' />
          <Text className='text-foreground font-medium'>
            {t('You completed this action {{date}}', { date: post.completedAt })}
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
    <ScrollView>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className='flex-1'
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View className='p-4'>
          <PostBody
            details={post.details}
            endTime={post.endTimeRaw}
            linkPreview={post.linkPreview}
            linkPreviewFeatured={post.linkPreviewFeatured}
            startTime={post.startTimeRaw}
            title={post.title}
            type={post.type}
            post={post}
            currentUser={currentUser}
          />

          <View className='mt-8'>
            <Text className='text-foreground font-medium mb-4'>{t('Complete Action')}</Text>
            {instructions && (
              <Text className='font-bold mb-4'>{instructions}</Text>
            )}
            
            <TouchableOpacity 
              className='flex-row items-center justify-center border-2 border-dashed border-foreground/20 rounded-md p-4'
              onPress={handleShowFilePicker}
              disabled={filePickerPending}
            >
              {filePickerPending ? (
                <Loading size={24} className='mr-2' />
              ) : (
                <Upload className='w-6 h-6 text-foreground mr-2' />
              )}
              <Text className='text-foreground'>{t('Upload Attachments')}</Text>
            </TouchableOpacity>
            
            <FileSelector
              onRemove={attachment => removeAttachment('file', attachment)}
              files={post.getFiles()}
            />

            {completionResponse.length > 0 && (
              <TouchableOpacity
                className='mt-4 p-3 rounded-lg bg-primary'
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text className='text-center font-medium text-primary-foreground'>
                  {submitting ? t('Submitting...') : t('Submit Attachments and Complete')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScrollView>
  )
} 