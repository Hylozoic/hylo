import React, { useEffect, useState, useRef } from 'react'
import { Text, View, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useClient, useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import createGroupMutation from '@hylo/graphql/mutations/createGroupMutation'
import groupDetailsQueryMaker from '@hylo/graphql/queries/groupDetailsQueryMaker'
import { AnalyticsEvents } from '@hylo/shared'
import { trackWithConsent } from 'services/mixpanel'
import { useChangeToGroup } from 'hooks/useHandleCurrentGroup'
import { useCreateGroupStore } from './CreateGroup.store'
import { BASE_STRING } from './CreateGroupUrl'
import { GroupPrivacyOption } from './CreateGroupVisibilityAccessibility'
import { GroupRow } from './CreateGroupParentGroups'
import ErrorBubble from 'components/ErrorBubble'
import Loading from 'components/Loading'
import useCurrentUser from '@hylo/hooks/useCurrentUser'

const EditButton = ({ onPress }) => {
  const { t } = useTranslation()
  return (
    <TouchableOpacity onPress={onPress}>
      <Text className='text-foreground/80 text-xs font-bold'>{t('Edit')}</Text>
    </TouchableOpacity>
  )
}

export const CreateGroupReview = React.forwardRef((_props, ref) => {
  const { t } = useTranslation()
  const { groupData, getMutationData, clearStore, goToStep, setSubmit, submit, setIsSubmitting, isSubmitting } = useCreateGroupStore()
  const client = useClient()
  const changeToGroup = useChangeToGroup()
  const [, createGroup] = useMutation(createGroupMutation)
  const [error, setError] = useState(null)
  const [{ currentUser }] = useCurrentUser()
  const clearStoreTimeoutRef = useRef(null)

  useEffect(() => {
    if (submit) {
      (async () => {
        try {
          setSubmit(false)
          setIsSubmitting(true)
          const { error } = await createGroup({ data: getMutationData() })
          const { data } = await client.query(
            groupDetailsQueryMaker({ withJoinQuestions: true, withPrerequisiteGroups: true }),
            { slug: groupData.slug }
          ).toPromise()

          if (data?.group) {
            trackWithConsent(AnalyticsEvents.GROUP_CREATED, {}, currentUser, !currentUser)
            changeToGroup(data.group.slug, { skipCanViewCheck: true })
            clearStoreTimeoutRef.current = setTimeout(() => {
              clearStore()
            }, 5000)
          } else {
            setIsSubmitting(false)
            setError('Group may have been created, but there was an error. Please contact Hylo support.', error)
          }
        } catch (e) {
          setIsSubmitting(false)
          setError(e.message)
        }
      })()
    }
  }, [submit])

  useEffect(() => {
    return () => {
      if (clearStoreTimeoutRef.current) {
        clearTimeout(clearStoreTimeoutRef.current)
      }
      if (isSubmitting) {
        clearStore()
      }
    }
  }, [isSubmitting, clearStore])

  if (isSubmitting) {
    return (
      <View className='flex-1 justify-center items-center p-8'>
        <View className='mb-6'>
          <Text className='text-foreground text-2xl font-bold text-center mb-2'>{t('Creating your group...')}</Text>
          <Text className='text-foreground/70 text-center'>{t('This will just take a moment')}</Text>
        </View>
        <View className='mb-8'>
          <Loading size='large' />
        </View>
        <TouchableOpacity 
          onPress={() => {
            if (clearStoreTimeoutRef.current) {
              clearTimeout(clearStoreTimeoutRef.current)
            }
            setIsSubmitting(false)
            clearStore()
          }}
          className='px-4 py-2 border border-foreground/30 rounded-lg'
        >
          <Text className='text-foreground/70 text-sm'>{t('Cancel')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <View className='mb-5'>
        <Text className='text-foreground text-xl font-bold pb-2.5'>{t('Everything look good')}</Text>
        <Text className='text-foreground/80 mb-1'>{t('You can always come back and change your details at any time')}</Text>
      </View>
      <View>
        <View className='mb-4 pb-2.5 border-b border-foreground/20'>
          <View className='flex-row justify-between items-center'>
            <Text className='text-foreground/90 font-bold'>{t('Whats the name of your group?')}</Text>
            <EditButton onPress={() => goToStep(0)} />
          </View>
          <TextInput
            className='text-foreground text-lg'
            value={groupData.name}
            underlineColorAndroid='transparent'
            editable={false}
            selectTextOnFocus={false}
          />
        </View>

        <View className='mb-4 pb-2.5 border-b border-foreground/20'>
          <View className='flex-row justify-between items-center'>
            <Text className='text-foreground/90 font-bold'>{t('Whats the URL of your group?')}</Text>
            <EditButton onPress={() => goToStep(1)} />
          </View>
          <TextInput
            className='text-foreground text-lg'
            value={BASE_STRING + groupData.slug}
            underlineColorAndroid='transparent'
            editable={false}
            selectTextOnFocus={false}
          />
        </View>

        <View className='mb-4 pb-2.5 border-b border-foreground/20'>
          <View className='flex-row justify-between items-center'>
            <Text className='text-foreground/90 font-bold'>{t('What is the purpose of this group')}</Text>
            <EditButton onPress={() => goToStep(2)} />
          </View>
          <TextInput
            className='text-foreground text-lg'
            multiline
            value={groupData.purpose}
            underlineColorAndroid='transparent'
            editable={false}
            selectTextOnFocus={false}
          />
        </View>

        <View className='mb-4 pb-2.5 border-b border-foreground/20'>
          <View className='flex-row justify-between items-center'>
            <Text className='text-foreground/90 font-bold'>{t('Who can see this group?')}</Text>
            <EditButton onPress={() => goToStep(3)} />
          </View>
          <GroupPrivacyOption option={groupData.visibility} />
        </View>

        <View className='mb-4 pb-2.5 border-b border-foreground/20'>
          <View className='flex-row justify-between items-center'>
            <Text className='text-foreground/90 font-bold'>{t('Who can join this group?')}</Text>
            <EditButton onPress={() => goToStep(3)} />
          </View>
          <GroupPrivacyOption option={groupData.accessibility} />
        </View>

        {groupData.parentGroups.length > 0 && (
          <View className='mb-4 pb-2.5 border-b border-foreground/20'>
            <View className='flex-row justify-between items-center'>
              <Text className='text-foreground/90 font-bold'>{t('Is this group a member of other groups?')}</Text>
              <EditButton onPress={() => goToStep(4)} />
            </View>
            <View style={stepStyles.groupRows}>
              {groupData.parentGroups.map(parentGroup => <GroupRow group={parentGroup} key={parentGroup.id} />)}
            </View>
          </View>
        )}
      </View>
      {error && <View className='mt-[-8]'><ErrorBubble text={error} /></View>}
    </>
  )
})

export default CreateGroupReview

const stepStyles = StyleSheet.create({
  groupRows: {
    marginTop: 10,
    paddingBottom: 13,
    minWidth: '90%',
    justifyContent: 'flex-start',
    flexWrap: 'wrap'
  }
})
