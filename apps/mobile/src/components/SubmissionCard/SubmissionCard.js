import React, { useState, useCallback, useMemo, useEffect } from 'react'
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
  const [isFocused, setIsFocused] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [, executeAllocate] = useMutation(allocateTokensToSubmissionMutation)

  const tokenLabel = fundingRound?.tokenType || t('Votes')

  // Calculate available tokens including currently allocated tokens for this submission
  const availableTokens = useMemo(() => {
    return (currentTokensRemaining || 0) + (localVoteAmount || 0)
  }, [currentTokensRemaining, localVoteAmount])

  // Sync inputValue with localVoteAmount when not focused
  useEffect(() => {
    if (!isFocused) {
      setInputValue(String(localVoteAmount || 0))
    }
  }, [localVoteAmount, isFocused])

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
    // Allow empty string while typing
    setInputValue(text)

    // If empty, don't update the actual value yet
    if (text === '' || text === '-') {
      return
    }

    let newValue = parseInt(text)
    if (isNaN(newValue) || newValue < 0) {
      return
    }

    // Enforce maximum constraints
    if (fundingRound.maxTokenAllocation && newValue > fundingRound.maxTokenAllocation) {
      newValue = fundingRound.maxTokenAllocation
      setInputValue(String(newValue))
    }
    if (newValue > availableTokens) {
      newValue = availableTokens
      setInputValue(String(newValue))
    }

    setLocalVoteAmount(newValue)

    // Validate and set error message
    const error = validateVoteAmount(newValue)
    setValidationError(error)
  }, [availableTokens, fundingRound.maxTokenAllocation, validateVoteAmount, setLocalVoteAmount])

  const handleVoteAmountFocus = useCallback(() => {
    setIsFocused(true)
    setInputValue(String(localVoteAmount || 0))
  }, [localVoteAmount])

  const handleVoteAmountBlur = useCallback(async () => {
    setIsFocused(false)

    // If input is empty, reset to 0
    let finalValue = parseInt(inputValue) || 0
    if (finalValue < 0) finalValue = 0

    // Enforce maximum constraints
    if (fundingRound.maxTokenAllocation && finalValue > fundingRound.maxTokenAllocation) {
      finalValue = fundingRound.maxTokenAllocation
    }
    if (finalValue > availableTokens) {
      finalValue = availableTokens
    }

    // Update the value and input display
    setLocalVoteAmount(finalValue)
    setInputValue(String(finalValue))

    // Validate
    const error = validateVoteAmount(finalValue)
    setValidationError(error)

    // Only submit if there's no validation error and the value changed
    if (!error && finalValue !== submission.tokensAllocated) {
      try {
        console.log('Attempting to allocate tokens:', {
          postId: submission.id,
          tokens: finalValue,
          previousValue: submission.tokensAllocated
        })

        const result = await executeAllocate({
          postId: submission.id,
          tokens: finalValue
        })

        console.log('Allocate tokens result:', {
          hasData: !!result.data,
          hasError: !!result.error,
          data: result.data
        })

        if (result.error) {
          // Log full error details for debugging
          console.error('Failed to allocate tokens - GraphQL error:', {
            error: result.error,
            graphQLErrors: result.error.graphQLErrors,
            networkError: result.error.networkError,
            response: result.error.response,
            postId: submission.id,
            tokens: finalValue
          })

          const errorMessage = result.error.graphQLErrors?.[0]?.message ||
                               result.error.networkError?.message ||
                               result.error.message ||
                               t('Failed to allocate tokens')

          Alert.alert(t('Error'), errorMessage)
          // Reset to previous value on error
          setLocalVoteAmount(submission.tokensAllocated || 0)
        } else if (!result.data) {
          // No error but also no data - this shouldn't happen but handle it
          console.error('Failed to allocate tokens - no data returned:', result)
          Alert.alert(t('Error'), t('Failed to allocate tokens: No response from server'))
          setLocalVoteAmount(submission.tokensAllocated || 0)
        }
      } catch (error) {
        // Network errors or other exceptions
        console.error('Failed to allocate tokens - exception:', {
          error,
          message: error?.message,
          stack: error?.stack,
          postId: submission.id,
          tokens: finalValue
        })

        const errorMessage = error?.message || t('Failed to allocate tokens')
        Alert.alert(t('Error'), errorMessage)
        // Reset to previous value on error
        setLocalVoteAmount(submission.tokensAllocated || 0)
      }
    }
  }, [inputValue, availableTokens, fundingRound.maxTokenAllocation, validateVoteAmount, submission.tokensAllocated, submission.id, executeAllocate, setLocalVoteAmount, t])

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
            value={inputValue}
            onChangeText={handleVoteAmountChange}
            onFocus={handleVoteAmountFocus}
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
