import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Text, View, TextInput, ScrollView, TouchableOpacity
} from 'react-native'
import { useMutation } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { AnalyticsEvents } from '@hylo/shared'
import mixpanel from 'services/mixpanel'
import { formatDomainWithUrl } from './util'
import { createGroupMutation, clearCreateGroupStore, getGroupData } from './CreateGroupFlow.store'
import { accessibilityDescription, visibilityDescription } from '@hylo/presenters/GroupPresenter'
import { openURL } from 'hooks/useOpenURL'
import ErrorBubble from 'components/ErrorBubble'
import Avatar from 'components/Avatar'
import styles from './CreateGroupFlow.styles'
import { white } from 'style/colors'

export default function CreateGroupReview () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const [, createGroup] = useMutation(createGroupMutation)
  const groupData = useSelector(getGroupData)
  // TODO: URQL! - query for parent groups, remove related method in store
  // const parentGroups = useSelector(getNewGroupParentGroups)
  const [error, setError] = useState(null)

  useEffect(() => {
    return navigation.addListener('tabPress', async event => {
      event.preventDefault()
      await submit()
    })
  }, [navigation, groupData])

  const submit = useCallback(async () => {
    try {
      const { data, error } = await createGroup({ data: groupData })
      const newGroup = data?.createGroup
      if (newGroup) {
        mixpanel.track(AnalyticsEvents.GROUP_CREATED)
        dispatch(clearCreateGroupStore())
        openURL(`/groups/${newGroup.slug}`)
      } else {
        setError('Group may have been created, but there was an error. Please contact Hylo support.', error)
      }
    } catch (e) {
      setError(e.message)
    }
  }, [groupData])

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.heading}>{t('Everything look good?')}</Text>
          <Text style={styles.description}>{t('You can always come back and change your details at any time')}</Text>
        </View>
        <View style={styles.content}>

          <View style={styles.textInputContainer}>
            <View style={stepStyles.itemHeader}>
              <Text style={stepStyles.textInputLabel}>{t('Whats the name of your group?')}</Text>
              <EditButton onPress={() => navigation.navigate('CreateGroupName')} />
            </View>
            <TextInput
              style={stepStyles.reviewTextInput}
              value={groupData.name}
              underlineColorAndroid='transparent'
              editable={false}
              selectTextOnFocus={false}
            />
          </View>

          <View style={styles.textInputContainer}>
            <View style={stepStyles.itemHeader}>
              <Text style={stepStyles.textInputLabel}>{t('Whats the URL of your group?')}</Text>
              <EditButton onPress={() => navigation.navigate('CreateGroupUrl')} />
            </View>
            <TextInput
              style={stepStyles.reviewTextInput}
              value={formatDomainWithUrl(groupData.slug)}
              underlineColorAndroid='transparent'
              editable={false}
              selectTextOnFocus={false}
            />
          </View>

          <View style={styles.textInputContainer}>
            <View style={stepStyles.itemHeader}>
              <Text style={stepStyles.textInputLabel}>{t('What is the purpose of this group')}</Text>
              <EditButton onPress={() => navigation.navigate('CreateGroupPurpose')} />
            </View>
            <TextInput
              style={stepStyles.reviewTextInput}
              multiline
              value={groupData.purpose}
              underlineColorAndroid='transparent'
              editable={false}
              selectTextOnFocus={false}
            />
          </View>
        </View>

        <View style={styles.textInputContainer}>
          <View style={stepStyles.itemHeader}>
            <Text style={stepStyles.textInputLabel}>{t('Who can see this group?')}</Text>
            <EditButton onPress={() => navigation.navigate('CreateGroupVisibilityAccessibility')} />
          </View>
          <TextInput
            style={stepStyles.reviewTextInput}
            multiline
            value={visibilityDescription(groupData.visibility)}
            underlineColorAndroid='transparent'
            editable={false}
            selectTextOnFocus={false}
          />
        </View>

        <View style={styles.textInputContainer}>
          <View style={stepStyles.itemHeader}>
            <Text style={stepStyles.textInputLabel}>{t('Who can join this group?')}</Text>
            <EditButton onPress={() => navigation.navigate('CreateGroupVisibilityAccessibility')} />
          </View>
          <TextInput
            style={stepStyles.reviewTextInput}
            multiline
            value={accessibilityDescription(groupData.accessibility)}
            underlineColorAndroid='transparent'
            editable={false}
            selectTextOnFocus={false}
          />
        </View>

        {/* {parentGroups.length > 0 && (
          <View style={styles.textInputContainer}>
            <View style={stepStyles.itemHeader}>
              <Text style={stepStyles.textInputLabel}>{t('Is this group a member of other groups?')}</Text>
              <EditButton onPress={() => navigation.navigate('CreateGroupParentGroups')} />
            </View>
            <View style={stepStyles.groupRows}>
              {parentGroups.map(parentGroup => <GroupRow group={parentGroup} key={parentGroup.id} />)}
            </View>
          </View>
        )} */}

        {error && <View style={styles.errorBubble}><ErrorBubble text={error} /></View>}
      </ScrollView>
    </View>
  )
}

const GroupRow = ({ group }) => (
  <View style={stepStyles.groupRow} key={group.name}>
    <Avatar style={stepStyles.groupAvatar} avatarUrl={group.avatarUrl} dimension={20} />
    <Text style={stepStyles.groupName}>{group.name}</Text>
  </View>
)

const EditButton = ({ onPress }) => {
  const { t } = useTranslation()

  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={stepStyles.editLink}>{t('Edit')}</Text>
    </TouchableOpacity>
  )
}

const stepStyles = {
  textInputLabel: {
    color: white,
    fontSize: 16,
    marginBottom: 5
  },
  reviewTextInput: {
    color: white,
    fontSize: 16,
    fontWeight: 'bold',
    padding: 0,
    paddingBottom: 20
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  groupRows: {
    marginTop: 10,
    paddingBottom: 13,
    minWidth: '90%',
    justifyContent: 'flex-start',
    flexWrap: 'wrap'
  },
  groupRow: {
    marginBottom: 10,
    paddingBottom: 0,
    flexDirection: 'row'
  },
  groupAvatar: {
    marginRight: 14
  },
  groupName: {
    fontFamily: 'Circular-Bold',
    fontSize: 14,
    color: white,
    flex: 1
  },
  editLink: {
    fontSize: 12,
    fontWeight: 'bold',
    color: white
  },
  editIcon: {
    fontSize: 22,
    color: white
  }
}
