import React, { useCallback, useMemo, useState } from 'react'
import { debounce } from 'lodash/fp'
import { useSelector, useDispatch } from 'react-redux'
import { useQuery } from 'urql'
import { Text, View, ScrollView, TextInput } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import ErrorBubble from 'components/ErrorBubble'
import {
  slugValidatorRegex, invalidSlugMessage,
  formatDomainWithUrl, removeDomainFromURL
} from './util'
import {
  updateGroupData, setWorkflowOptions,
  groupExistsCheckQuery, getGroupData
} from './CreateGroupFlow.store'
import styles from './CreateGroupFlow.styles'

export default function CreateGroupUrl ({ navigation }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const groupData = useSelector(getGroupData)
  const [error, providedSetError] = useState()
  const [groupSlug, setGroupSlug] = useState(groupData?.slug)
  const [groupExistsCheckResult] = useQuery({ query: groupExistsCheckQuery, variables: { slug: groupSlug } })

  const setError = error => {
    dispatch(setWorkflowOptions({ disableContinue: true }))
    providedSetError(error)
  }
  const clearError = () => providedSetError()

  const validateAndSave = useMemo(() => debounce(300, async (result, slug) => {
    try {
      if (!slug || slug.length === 0) {
        // setError('Please enter a URL')
        dispatch(setWorkflowOptions({ disableContinue: true }))
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
        dispatch(updateGroupData({ slug }))
        clearError()
        dispatch(setWorkflowOptions({ disableContinue: false }))
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
    dispatch(setWorkflowOptions({ disableContinue: true }))
    validateAndSave(groupExistsCheckResult, groupSlug)
  }, [groupExistsCheckResult?.data]))

  return (
    <View className="bg-secondary p-5 flex-1">
      <ScrollView keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <View className="mb-5">
          <Text className="text-secondary-foreground text-xl font-bold pb-2.5">{t('Choose an address for your group')}</Text>
          <Text className="text-secondary-foreground/80 mb-1">{t('Your URL is the address that members will use to access your group online The shorter the better')}</Text>
        </View>
        <View>
          <View className="mb-4 border-b border-secondary-foreground/20">
            <Text className="text-secondary-foreground/90 font-bold">{t('Whats the address for your group')}</Text>
            <TextInput
              className="text-secondary-foreground text-lg font-bold my-2.5"
              onChangeText={slug => setGroupSlug(removeDomainFromURL(slug))}
              returnKeyType='next'
              autoCapitalize='none'
              value={formatDomainWithUrl(groupSlug)}
              autoCorrect={false}
              underlineColorAndroid='transparent'
            />
          </View>
          {error && <View className="mt-[-8]"><ErrorBubble text={error} topArrow /></View>}
        </View>
      </ScrollView>
    </View>
  )
}
