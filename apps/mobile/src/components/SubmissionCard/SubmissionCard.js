import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'urql'
import allocateTokensToSubmissionMutation from '@hylo/graphql/mutations/allocateTokensToSubmissionMutation'
import PostCard from 'components/PostCard'

// Component for voting interface on a submission
function SubmissionCard ({
  submission,
  currentPhase,
  canVote,
  fundingRound,
  onPress,
  localVoteAmount,
  setLocalVoteAmount,
  currentTokensRemaining
}) {
  const { t } = useTranslation()
  const [validationError, setValidationError] = useState('')
  const [, executeAllocate] = useMutation(allocateTokensToSubmissionMutation)

  const tokenLabel = fundingRound?.tokenType || t('Votes')

  // Calculate available tokens including currently allocated tokens for this submission
  const availableTokens = useMemo(() => {
    return (currentTokensRemaining || 0) + (localVoteAmount || 0)
  }, [currentTokensRemaining, localVoteAmount])

  const validateVoteAmount = useCallback((value) => {
    // Check if exceeds available tokens
    if (value > availableTokens) {
      return t('Not enough tokens available')
    }

    // Check if exceeds max allocation per submission
    if (fundingRound.maxTokenAllocation && value > fundingRound.maxTokenAllocation) {
      return t('Cannot allocate more than {{max}} tokens per submission', { max: fundingRound.maxTokenAllocation })
    }

    // Check if below minimum allocation (when value > 0)
    if (value > 0 && fundingRound.minTokenAllocation && value < fundingRound.minTokenAllocation) {
      return t('Must allocate at least {{min}} tokens or 0', { min: fundingRound.minTokenAllocation })
    }

    return ''
  }, [availableTokens, fundingRound.maxTokenAllocation, fundingRound.minTokenAllocation, t])

  const handleVoteAmountChange = useCallback((text) => {
    let newValue = parseInt(text) || 0
    if (newValue < 0) newValue = 0

    // Enforce maximum constraints
    if (fundingRound.maxTokenAllocation && newValue > fundingRound.maxTokenAllocation) {
      newValue = fundingRound.maxTokenAllocation
    }
    if (newValue > availableTokens) {
      newValue = availableTokens
    }

    setLocalVoteAmount(newValue)

    // Validate and set error message
    const error = validateVoteAmount(newValue)
    setValidationError(error)
  }, [availableTokens, fundingRound.maxTokenAllocation, validateVoteAmount, setLocalVoteAmount])

  const handleVoteAmountBlur = useCallback(async () => {
    // Only submit if there's no validation error and the value changed
    if (!validationError && localVoteAmount !== submission.tokensAllocated) {
      try {
        const result = await executeAllocate({
          postId: submission.id,
          tokens: localVoteAmount
        })

        console.log('result', result)
        if (result.error) {
          Alert.alert(t('Error'), t('Failed to allocate tokens'))
          // Reset to previous value on error
          setLocalVoteAmount(submission.tokensAllocated || 0)
        }
      } catch (error) {
        console.error('Failed to allocate tokens:', error)
        Alert.alert(t('Error'), t('Failed to allocate tokens'))
        // Reset to previous value on error
        setLocalVoteAmount(submission.tokensAllocated || 0)
      }
    }
  }, [validationError, localVoteAmount, submission.tokensAllocated, submission.id, executeAllocate, setLocalVoteAmount, t])

  return (
    <View className='flex-row gap-2 bg-card/50 rounded-lg border-2 border-card/30 shadow-xl mb-1'>
      <TouchableOpacity
        className='flex-1'
        activeOpacity={0.6}
        delayPressIn={50}
        onPress={onPress}
      >
        <PostCard
          post={submission}
          onPress={onPress}
        />
      </TouchableOpacity>

      {currentPhase === 'voting' && canVote && (
        <View className='flex flex-col justify-center items-center gap-2 bg-foreground/5 p-4 rounded-r-lg'>
          <Text className='text-xs font-bold text-foreground/60 uppercase'>
            {t('Your {{tokenType}}', { tokenType: tokenLabel })}
          </Text>
          <TextInput
            value={String(localVoteAmount)}
            onChangeText={handleVoteAmountChange}
            onBlur={handleVoteAmountBlur}
            keyboardType='number-pad'
            className={`w-20 h-12 text-center text-2xl font-bold bg-input border-2 rounded-md ${
              validationError ? 'border-red-500' : 'border-foreground/20'
            }`}
          />
          {validationError && (
            <Text className='text-xs text-red-500 text-center max-w-[120px]'>
              {validationError}
            </Text>
          )}
        </View>
      )}

      {currentPhase === 'completed' && (
        <View className='flex flex-col justify-center items-end gap-1 bg-foreground/5 p-4 rounded-r-lg'>
          <Text className='text-xs font-semibold text-foreground/60 uppercase'>
            {t('Total {{tokenType}}', { tokenType: tokenLabel })}
          </Text>
          <Text className={`text-4xl font-bold ${
            (submission.totalTokensAllocated || 0) > 0 ? 'text-green-500' : 'text-foreground'
          }`}
          >
            {submission.totalTokensAllocated || 0}
          </Text>
          <Text className='text-sm font-semibold text-foreground/80 mt-1'>
            {t('You: {{tokens}}', { tokens: submission.tokensAllocated || 0 })}
          </Text>
        </View>
      )}
    </View>
  )
}

export default SubmissionCard
