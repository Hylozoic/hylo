import React, { useCallback, useEffect, useState } from 'react'
import { Text, View, ScrollView, TextInput } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import { useCreateGroupStore } from './CreateGroup.store'
import ErrorBubble from 'components/ErrorBubble'

export default function CreateGroupName ({ route }) {
  const { t } = useTranslation()
  // Add current group in as pre-selected as a parent group for Parent Groups Step
  const { groupData, updateGroupData, edited, setDisableContinue, clearStore } = useCreateGroupStore()
  const [{ currentGroup }] = useCurrentGroup()
  const [groupName, setGroupName] = useState()
  const [error, setError] = useState()
  const { reset } = useRouteParams()

  useEffect(() => {
    if (reset) {
      clearStore()
      setGroupName('')
    } else {
      setGroupName(groupData?.name)
    }
  }, [reset])

  useFocusEffect(useCallback(() => {
    if (!groupName || groupName.length === 0) {
      setDisableContinue(true)
    } else {
      updateGroupData({ name: groupName })
      setError()
      setDisableContinue(false)
    }
  }, [groupName]))

  useFocusEffect(useCallback(() => {
    if (!edited && !currentGroup?.isStaticContext) {
      updateGroupData({ parentGroups: [currentGroup] })
    }
  }, [edited, currentGroup?.id]))

  return (
    <>
      <View className='mb-5'>
        <Text className='text-foreground text-xl font-bold pb-2.5'>{t('Lets get started!')}</Text>
        <Text className='text-foreground/80 mb-1'>{t('All good things start somewhere! Lets kick things off with a catchy name for your group')}</Text>
      </View>
      <View>
        <View className='mb-4 border-b border-foreground/20'>
          <Text className='text-foreground/90 font-bold'>{t('Whats the name of your group?')}</Text>
          <TextInput
            className='text-foreground text-lg my-2.5'
            style={{ lineHeight: null }}
            onChangeText={setGroupName}
            returnKeyType='next'
            autoFocus
            autoCapitalize='none'
            value={groupName}
            autoCorrect={false}
            underlineColorAndroid='transparent'
            maxLength={60}
          />
        </View>
      </View>
      {error && (
        <ErrorBubble text={error} topArrow />
      )}
    </>
  )
}
