import React, { useCallback, useEffect, useState } from 'react'
import { Text, View, ScrollView, TextInput } from 'react-native'
import { useSelector, useDispatch } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import { getGroupData, getEdited, updateGroupData, setWorkflowOptions, clearCreateGroupStore } from './CreateGroupFlow.store'
import ErrorBubble from 'components/ErrorBubble'

export default function CreateGroupName ({ route }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  // Add current group in as pre-selected as a parent group for Parent Groups Step
  const edited = useSelector(getEdited)
  const [{ currentGroup }] = useCurrentGroup()
  const groupData = useSelector(getGroupData)
  const [groupName, setGroupName] = useState()
  const [error, setError] = useState()
  const { reset } = useRouteParams()

  useEffect(() => {
    if (reset) {
      dispatch(clearCreateGroupStore())
      setGroupName('')
    } else {
      setGroupName(groupData?.name)
    }
  }, [reset])

  useFocusEffect(useCallback(() => {
    if (!groupName || groupName.length === 0) {
      dispatch(setWorkflowOptions({ disableContinue: true }))
    } else {
      dispatch(updateGroupData({ name: groupName }))
      setError()
      dispatch(setWorkflowOptions({ disableContinue: false }))
    }
  }, [groupName]))

  useFocusEffect(useCallback(() => {
    if (!edited && !currentGroup?.isContextGroup) {
      dispatch(updateGroupData({ parentIds: [currentGroup?.id] }))
    }
  }, [edited, currentGroup?.id]))

  return (
    <View className='bg-background p-5 flex-1'>
      <ScrollView keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <View className='mb-5'>
          <Text className='text-foreground text-xl font-bold pb-2.5'>{t('Lets get started!')}</Text>
          <Text className='text-foreground/80 mb-1'>{t('All good things start somewhere! Lets kick things off with a catchy name for your group')}</Text>
        </View>
        <View>
          <View className='mb-4 border-b border-foreground/20'>
            <Text className='text-foreground/90 font-bold'>{t('Whats the name of your group?')}</Text>
            <TextInput
              className='text-foreground text-lg font-bold my-2.5'
              onChangeText={setGroupName}
              returnKeyType='next'
              autoCapitalize='none'
              value={groupName}
              autoCorrect={false}
              underlineColorAndroid='transparent'
              maxLength={60}
            />
          </View>
          {error && <View className='mt-[-8]'><ErrorBubble text={error} topArrow /></View>}
        </View>
      </ScrollView>
    </View>
  )
}
