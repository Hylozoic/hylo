import React, { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'urql'
import { TextHelpers } from '@hylo/shared'
import completePostMutation from '@hylo/graphql/mutations/completePostMutation'
import FilePicker from '../ImagePicker/ImagePicker'
import { useToast } from '../Toast'
import { Check, Upload } from 'lucide-react-native'
import RoundCheckbox from '../RoundCheckBox'
import RadioButton from '../RadioButton'
import CardFileAttachments from '../CardFileAttachments'

export default function PostCompletion({ post }) {
  const { t } = useTranslation()
  const showToast = useToast()
  console.log('post', post, post.completionResponse, 'asdasdas')
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
      console.error('NONONON', 'wowowowowowowo')
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
          <FilePicker
            type='postCompletion'
            onChoice={handleFileChoice}
            allowMultiple
          >
            <TouchableOpacity className='flex-row items-center justify-center border-2 border-dashed border-foreground/20 rounded-md p-4'>
              <Upload className='w-6 h-6 text-foreground mr-2' />
              <Text className='text-foreground'>{t('Upload Attachments')}</Text>
            </TouchableOpacity>
          </FilePicker>
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
      <View className='p-4 bg-background-plus rounded-lg mb-4'>
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
    <View className='p-4 bg-background-plus rounded-lg mb-4'>
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
    </View>
  )
} 