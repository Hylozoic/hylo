import React, { useCallback, useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, ScrollView, TextInput } from 'react-native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import {
  getGroupData, getEdited, updateGroupData, setWorkflowOptions,
  clearCreateGroupStore
} from './CreateGroupFlow.store'
import ErrorBubble from 'components/ErrorBubble'
import styles from './CreateGroupFlow.styles'
import { useTranslation } from 'react-i18next'

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
    <View style={styles.container}>
      <ScrollView keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <View style={styles.header}>
          <Text style={styles.heading}>{t('Lets get started!')}</Text>
          <Text style={styles.description}>{t('All good things start somewhere! Lets kick things off with a catchy name for your group')}</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.textInputContainer}>
            <Text style={styles.textInputLabel}>{t('Whats the name of your group?')}</Text>
            <TextInput
              style={styles.textInput}
              onChangeText={setGroupName}
              returnKeyType='next'
              autoCapitalize='none'
              value={groupName}
              autoCorrect={false}
              underlineColorAndroid='transparent'
              maxLength={60}
            />
          </View>
          {error && <View style={styles.errorBubble}><ErrorBubble text={error} topArrow /></View>}
        </View>
      </ScrollView>
    </View>
  )
}
