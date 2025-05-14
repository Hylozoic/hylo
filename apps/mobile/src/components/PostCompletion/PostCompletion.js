import React, { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'urql'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TextHelpers } from '@hylo/shared'
import completePostMutation from '@hylo/graphql/mutations/completePostMutation'
import useTrack from '@hylo/hooks/useTrack'
import { useToast } from '../Toast'
import { Check, Upload, Loading } from 'lucide-react-native'
import RoundCheckbox from '../RoundCheckBox'
import RadioButton from '../RadioButton'
import { useDispatch } from 'react-redux'
import FileSelector, { showFilePicker } from '../../screens/PostEditor/FileSelector'
import uploadAction from 'store/actions/upload'
import { isIOS } from 'util/platform'

export default function PostCompletion({ post, trackId }) {
  const { t } = useTranslation()
  const showToast = useToast()
  const dispatch = useDispatch()
  const [filePickerPending, setFilePickerPending] = useState(false)
  const upload = useCallback((...params) => dispatch(uploadAction(...params)), [dispatch])

  const [completionResponse, setCompletionResponse] = useState(post.completionResponse || [])
  const [submitting, setSubmitting] = useState(false)
  const { completionAction, completionActionSettings } = post
  const { instructions, options } = completionActionSettings || {}
  const [currentTrack, trackQueryInfo, refetchTrack] = useTrack({ trackId })
  const [, completePost] = useMutation(completePostMutation)

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
          text1: 'Error',
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
            text1: t('You have completed the track: {{trackName}}', { trackName: currentTrack.name }),
          })
        } else {
          showToast({
            type: 'success',
            text1: t('Action completed')
          })
        }
      }
    } catch (error) {
      console.error('Error completing post', error)
      showToast({
        type: 'error',
        text1: 'Error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!completionAction) return null

  const completedAt = post.completedAt ? TextHelpers.formatDatePair(post.completedAt) : null
  let completionControls = null
  let completionButtonText = null
  let alreadyCompletedMessage = null
  let completionResponseText = <Text>{completionResponse.map(r => r).join(', ')}</Text>

  switch (completionAction) {
    case 'button':
      completionButtonText = t('Mark as Complete')
      alreadyCompletedMessage = t('You completed this action {{date}}', { date: completedAt })
      break

    case 'selectOne':
      completionControls = (
        <View className='mb-4'>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              className='flex-row items-center gap-3 mb-3'
              onPress={() => setCompletionResponse([option])}
            >
              <RadioButton checked={completionResponse[0] === option} onValueChange={() => setCompletionResponse([option])} />
              <Text>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )
      completionButtonText = t('Submit')
      alreadyCompletedMessage = t('You completed this action {{date}}. You selected:', { date: completedAt })
      break

    case 'selectMultiple':
      completionControls = (
        <View className='mb-4'>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              className='flex-row items-center gap-3 mb-3'
              onPress={() => {
                setCompletionResponse(prev => {
                  if (prev.includes(option)) {
                    return prev.filter(item => item !== option)
                  } else {
                    return [...prev, option]
                  }
                })
              }}
            >
              <RoundCheckbox
                checked={completionResponse.includes(option)}
                onValueChange={() => {
                  setCompletionResponse(prev => {
                    if (prev.includes(option)) {
                      return prev.filter(item => item !== option)
                    } else {
                      return [...prev, option]
                    }
                  })
                }}
              />
              <Text>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )
      completionButtonText = t('Submit')
      alreadyCompletedMessage = t('You completed this action {{date}}. You selected:', { date: completedAt })
      break

    case 'text':
      completionControls = (
        <TextInput
          className='w-full border-2 border-border bg-input rounded-md p-2 mb-4 min-h-[100] text-foreground'
          value={completionResponse[0] || ''}
          onChangeText={(text) => setCompletionResponse([text])}
          multiline
          textAlignVertical='top'
        />
      )
      completionButtonText = t('Submit')
      const completionResponseText = completionResponse[0] || ''
      alreadyCompletedMessage = t('You completed this action {{date}}. Your response was:', { date: completedAt }) + ' ' + completionResponseText
      break

    case 'comment':
    case 'reaction':
      completionControls = null
      completionButtonText = null
      alreadyCompletedMessage = t('You completed this action {{date}}', { date: completedAt })
      break
  }

  if (post.completedAt) {
    return (
      <View 
        className='p-4 bg-background-plus rounded-lg mb-4'
      >
        <View className='flex-row items-center'>
          <Check className='w-5 h-5 text-success mr-2' />
          <Text className='text-foreground font-medium'>
            {t('You completed this {{actionTerm}} {{date}}.', { 
              date: completedAt, 
              actionTerm: currentTrack?.actionsName?.slice(0, -1) || t('action')
            })}
            {alreadyCompletedMessage && ' ' + alreadyCompletedMessage}
          </Text>
        </View>
        {completionResponse?.length > 0 && (
          <View className='mt-2'>
            {completionResponseText}
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView 
      className='p-4 bg-background rounded-lg mb-4'
    >
      <Text className='text-foreground font-medium mb-4'>{t('Complete Action')}</Text>
      {instructions && (
        <Text className='font-bold mb-4'>{instructions}</Text>
      )}
      
      {completionControls}

      {completionButtonText && (
        <TouchableOpacity
          onPress={handleSubmitCompletion}
          disabled={submitting}
          className={`p-3 rounded-lg ${submitting ? 'bg-background' : 'bg-primary'}`}
        >
          <Text
            className={`text-center font-medium ${
              submitting ? 'text-foreground-muted' : 'text-primary-foreground'
            }`}
          >
            {submitting ? t('Submitting') + '...' : t(completionButtonText)}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
} 