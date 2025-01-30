import React, { useCallback, useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, ScrollView, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import useRouteParams from 'hooks/useRouteParams'
import useCurrentGroup from 'frontend-shared/hooks/useCurrentGroup'
import {
  getGroupData, getEdited, updateGroupData, setWorkflowOptions,
  clearCreateGroupStore
} from './CreateGroupFlow.store'
import ErrorBubble from 'components/ErrorBubble'
import styles from './CreateGroupFlow.styles'
import { ALL_GROUP_ID, MY_CONTEXT_ID, PUBLIC_GROUP_ID } from 'frontend-shared/presenters/GroupPresenter'

export default function CreateGroupPurpose ({ route }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  // Add current group in as pre-selected as a parent group for Parent Groups Step
  const edited = useSelector(getEdited)
  const [{ currentGroup }] = useCurrentGroup()
  const groupData = useSelector(getGroupData)
  const [groupPurpose, setGroupPurpose] = useState()
  const [error, setError] = useState()
  const { reset } = useRouteParams()

  useEffect(() => {
    if (reset) {
      dispatch(clearCreateGroupStore())
      setGroupPurpose('')
    } else {
      setGroupPurpose(groupData?.purpose)
    }
  }, [reset])

  useFocusEffect(useCallback(() => {
    dispatch(updateGroupData({ purpose: groupPurpose }))
    setError()
    dispatch(setWorkflowOptions({ disableContinue: false }))
  }, [groupPurpose]))

  useFocusEffect(useCallback(() => {
    if (!edited && ![ALL_GROUP_ID, PUBLIC_GROUP_ID, MY_CONTEXT_ID].includes(currentGroup?.id)) {
      dispatch(updateGroupData({ parentIds: [currentGroup?.id] }))
    }
  }, [edited, currentGroup?.id]))

  return (
    <View style={styles.container}>
      <ScrollView keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <View style={styles.header}>
          <Text style={styles.heading}>{t('Group Purpose')}</Text>
          <Text style={styles.description}>{t('Your purpose statement is a concise summary of why your group')}</Text>
          <Text style={styles.description}>{t('Aim for one or two sentences')}</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.textInputContainer}>
            <Text style={styles.textInputLabel}>{t('Whats the purpose of the group?')}</Text>
            <TextInput
              style={styles.textInput}
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
          {error && <View style={styles.errorBubble}><ErrorBubble text={error} topArrow /></View>}
        </View>
      </ScrollView>
    </View>
  )
}
