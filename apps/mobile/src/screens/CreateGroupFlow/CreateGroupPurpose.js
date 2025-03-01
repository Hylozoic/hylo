import React, { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, ScrollView, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import KeyboardManager from 'react-native-keyboard-manager'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import { useCreateGroupStore } from './CreateGroupFlow.store'
import ErrorBubble from 'components/ErrorBubble'

export default function CreateGroupPurpose ({ route }) {
  const { t } = useTranslation()
  const { edited, groupData, updateGroupData, setDisableContinue, clearStore } = useCreateGroupStore()
  // Add current group in as pre-selected as a parent group for Parent Groups Step
  const [{ currentGroup }] = useCurrentGroup()
  const [groupPurpose, setGroupPurpose] = useState()
  const [error, setError] = useState()
  const { reset } = useRouteParams()

  useFocusEffect(useCallback(() => {
    KeyboardManager.setEnable(true)
    return () => {
      KeyboardManager.setEnable(false)
    }
  }, []))

  useEffect(() => {
    if (reset) {
      clearStore()
      setGroupPurpose('')
    } else {
      setGroupPurpose(groupData?.purpose)
    }
  }, [reset])

  useFocusEffect(useCallback(() => {
    updateGroupData({ purpose: groupPurpose })
    setError()
    setDisableContinue(false)
  }, [groupPurpose]))

  useFocusEffect(useCallback(() => {
    if (!edited && !currentGroup?.isContextGroup) {
      updateGroupData({ parentGroups: [currentGroup] })
    }
  }, [edited, currentGroup?.id]))

  return (
    <View className='bg-background p-5 flex-1'>
      <ScrollView keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <View className='mb-5'>
          <Text className='text-foreground text-xl font-bold pb-2.5'>{t('Group Purpose')}</Text>
          <Text className='text-foreground/80 mb-1'>{t('Your purpose statement is a concise summary of why your group')}</Text>
          <Text className='text-foreground/80 mb-1'>{t('Aim for one or two sentences')}</Text>
        </View>
        <View>
          <View className='mb-4 border-b border-foreground/20'>
            <Text className='text-foreground/90 font-bold'>{t('Whats the purpose of the group?')}</Text>
            <TextInput
              className='text-foreground text-lg my-2.5'
              onChangeText={setGroupPurpose}
              returnKeyType='next'
              autoCapitalize='none'
              value={groupPurpose}
              autoCorrect={false}
              underlineColorAndroid='transparent'
              maxLength={500}
              multiline
            />
          </View>
          {error && <View className='mt-[-8]'><ErrorBubble text={error} topArrow /></View>}
        </View>
      </ScrollView>
    </View>
  )
}
