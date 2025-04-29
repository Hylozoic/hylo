import React, { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'urql'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TextHelpers } from '@hylo/shared'
import completePostMutation from '@hylo/graphql/mutations/completePostMutation'
import { useToast } from '../Toast'
import { Check, Upload, Loading } from 'lucide-react-native'
import RoundCheckbox from '../RoundCheckBox'
import RadioButton from '../RadioButton'
import CardFileAttachments from '../CardFileAttachments'
import { useDispatch } from 'react-redux'
import FileSelector, { showFilePicker } from '../../screens/PostEditor/FileSelector'
import uploadAction from 'store/actions/upload'
import { isIOS } from 'util/platform'

export default function PostCompletion({ post }) {
  const { t } = useTranslation()
  const showToast = useToast()
  const dispatch = useDispatch()
  const [filePickerPending, setFilePickerPending] = useState(false)
  const upload = useCallback((...params) => dispatch(uploadAction(...params)), [dispatch])

  const [completionResponse, setCompletionResponse] = useState(post.completionResponse || [])
  const [submitting, setSubmitting] = useState(false)
  const { completionAction, completionActionSettings } = post
  const { instructions, options } = completionActionSettings || {}

  const [, completePost] = useMutation(completePostMutation)

  const handleFileChoice = ({ local, remote }) => {
    if (remote) {
      setCompletionResponse(prev => [...prev, { url: remote, localUri: local }])
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

        showToast({
          type: 'error',
          text1: 'Error completing post',
          text2: error
        })
        return
      }

      const completedPost = data.completePost
      if (completedPost) {
        showToast({
          type: 'success',
          text1: 'Post completed successfully'
        })
      }
    } catch (error) {
      console.error('Error completing post', error)
      showToast({
        type: 'error',
        text1: 'Error completing post',
        text2: error
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
      completionButtonText = 'Mark as Complete'
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
      completionButtonText = 'Submit'
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
      completionButtonText = 'Submit'
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
      completionButtonText = 'Submit'
      alreadyCompletedMessage = t('You completed this action {{date}}. Your response was:', { date: completedAt })
      break

    case 'uploadFile':
      completionControls = (
        <View className='mb-4'>
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
              files={completionResponse.map(a => ({ ...a, type: 'file' }))}
            />
          {completionResponse.length > 0 && (
            <View className='mt-4'>
              <CardFileAttachments attachments={completionResponse.map(a => ({ ...a, type: 'file' }))} />
            </View>
          )}
        </View>
      )
      completionButtonText = completionResponse.length > 0 ? 'Submit Attachments and Complete' : null
      alreadyCompletedMessage = t('You completed this action at {{date}}. Your uploaded attachments:', { date: completedAt })
      completionResponseText = <CardFileAttachments attachments={completionResponse.map(a => ({ ...a, type: 'file' }))} />
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
          <Text className='text-foreground font-medium'>{alreadyCompletedMessage}</Text>
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
          onPress={handleSubmit}
          disabled={submitting}
          className={`p-3 rounded-lg ${submitting ? 'bg-background' : 'bg-primary'}`}
        >
          <Text
            className={`text-center font-medium ${
              submitting ? 'text-foreground-muted' : 'text-primary-foreground'
            }`}
          >
            {submitting ? t('Submitting...') : t(completionButtonText)}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
} 