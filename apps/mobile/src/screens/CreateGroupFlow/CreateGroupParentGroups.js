import React, { useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { Text, TouchableOpacity, FlatList } from 'react-native'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import { white } from 'style/colors'
import { GROUP_ACCESSIBILITY } from '@hylo/presenters/GroupPresenter'
import { getGroupData, updateGroupData } from './CreateGroupFlow.store'
import styles from './CreateGroupFlow.styles'
import { useTranslation } from 'react-i18next'
import useCurrentUser from '@hylo/hooks/useCurrentUser'

export default function CreateGroupParentGroups ({ navigation }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [{ currentUser }] = useCurrentUser()
  const groupData = useSelector(getGroupData)
  const [parentIds, setParentGroupIds] = useState(groupData.parentIds)
  const memberships = currentUser?.memberships
  const parentGroupOptions = memberships
    .filter(m => m.hasModeratorRole || m.group.accessibility === GROUP_ACCESSIBILITY.Open)
    .map((m) => m.group)
    .sort((a, b) => a.name.localeCompare(b.name))

  const isChosen = item => !!parentIds.find(groupId => groupId === item.id)

  const toggleChosen = item => parentIds.find(groupId => groupId === item.id)
    ? setParentGroupIds(parentIds.filter(groupId => groupId !== item.id))
    : setParentGroupIds([...parentIds, item.id])

  const clear = () => setParentGroupIds([])

  useFocusEffect(useCallback(() => {
    // Extra step necessary to reject a default group selection which isn't valid
    parentIds.filter(id => parentGroupOptions.find(validId => id === validId))
    dispatch(updateGroupData({ parentIds }))
  }, [parentIds]))

  return (
    <KeyboardFriendlyView style={styles.container}>
      <Text style={styles.heading}>{t('Is this group a member of other groups?')}</Text>
      <Text style={stepStyles.subHeading}>{t('Please select below:')}</Text>
      {/* TODO: ItemSelectorModal  */}
      {/* <FlatList
        style={stepStyles.parentGroupListContainer}
        data={parentGroupOptions}
        renderItem={({ item }) => (
          <ItemChooserItemRow item={item} chosen={isChosen(item)} toggleChosen={toggleChosen} />
        )}
      /> */}
      <TouchableOpacity onPress={clear}>
        <Text style={stepStyles.clearButton}>{t('Clear')}</Text>
      </TouchableOpacity>
    </KeyboardFriendlyView>
  )
}

const stepStyles = {
  subHeading: {
    color: white,
    marginTop: 10,
    marginBottom: 10
  },
  clearButton: {
    color: white,
    marginTop: 10,
    marginBottom: 20,
    marginRight: 20,
    fontWeight: 'bold',
    alignSelf: 'flex-end'
  },
  parentGroupListContainer: {
    minWidth: '90%',
    padding: 0,
    backgroundColor: white,
    borderRadius: 15
  }
}
