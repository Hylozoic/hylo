import React, { useCallback, useMemo, useState } from 'react'
import { Text, View, TextInput } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useQuery } from 'urql'
import { useTranslation } from 'react-i18next'
import { debounce } from 'lodash/fp'
import groupExistsQuery from '@hylo/graphql/queries/groupExistsQuery'
import { useCreateGroupStore } from './CreateGroup.store'
import ErrorBubble from 'components/ErrorBubble'

export const BASE_STRING = 'hylo.com/groups/'
export const slugValidatorRegex = /^[0-9a-z-]{2,40}$/
export const invalidSlugMessage = 'URLs must have between 2 and 40 characters, and can only have lower case letters, numbers, and dashes.'

export default function CreateGroupUrl ({ navigation }) {
  const { t } = useTranslation()
  const { groupData, updateGroupData, setDisableContinue } = useCreateGroupStore()
  const [error, providedSetError] = useState()
  const [groupSlug, setGroupSlug] = useState(groupData?.slug)
  const [groupExistsCheckResult] = useQuery({ query: groupExistsQuery, variables: { slug: groupSlug } })

  const setError = error => {
    setDisableContinue(true)
    providedSetError(error)
  }
  const clearError = () => providedSetError()

  const validateAndSave = useMemo(() => debounce(300, async (result, slug) => {
    try {
      if (!slug || slug.length === 0) {
        // setError('Please enter a URL')
        setDisableContinue(true)
        return false
      }

      if (!slugValidatorRegex.test(slug)) {
        setError(invalidSlugMessage)
        return false
      }

      const groupExists = result?.data?.groupExists?.exists

      if (result?.error) {
        setError(t('There was an error please try again'))
      } else if (groupExists === false) {
        updateGroupData({ slug })
        clearError()
        setDisableContinue(false)
      } else if (groupExists) {
        setError(t('This URL already exists Please choose another one'))
      } else {
        // if there is no error or groupExists variable, assume some other error
        setError(t('There was an error please try again'))
      }
    } catch (error) {
      setError(t('There was an error please try again'))
    }
  }), [])

  useFocusEffect(useCallback(() => {
    setDisableContinue(true)
    validateAndSave(groupExistsCheckResult, groupSlug)
  }, [groupExistsCheckResult?.data]))

  return (
    <>
      <View className='mb-5'>
        <Text className='text-foreground text-xl font-bold pb-2.5'>{t('Choose an address for your group')}</Text>
        <Text className='text-foreground/80 mb-1'>{t('Your URL is the address that members will use to access your group online The shorter the better')}</Text>
      </View>
      <View>
        <Text className='text-foreground/90 font-bold'>{t('Whats the address for your group')}</Text>
        <View className='border-b border-foreground/20 my-4 pb-4' style={{ flexDirection: 'row' }}>
          <TextInput
            className='text-lg'
            style={{ lineHeight: null }}
            value={BASE_STRING}
            editable={false}
            underlineColorAndroid='transparent'
          />
          <TextInput
            className='text-lg'
            style={{ lineHeight: null, flex: 1 }}
            onChangeText={slug => setGroupSlug(slug)}
            value={groupSlug}
            returnKeyType='next'
            autoCapitalize='none'
            autoFocus
            autoCorrect={false}
            underlineColorAndroid='transparent'
            maxLength={40}
          />
        </View>
      </View>
      {error && (
        <ErrorBubble text={error} topArrow />
      )}
    </>
  )
}
