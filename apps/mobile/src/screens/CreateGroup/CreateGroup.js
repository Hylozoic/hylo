import React from 'react'
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { GROUP_ACCESSIBILITY } from '@hylo/presenters/GroupPresenter'
import { isIOS } from 'util/platform'
import useKeyboardVisible from 'hooks/useKeyboardVisible'
import useConfirmDiscardChanges from 'hooks/useConfirmDiscardChanges'
import { useCreateGroupStore } from './CreateGroup.store'
import CreateGroupName from 'screens/CreateGroup/CreateGroupName'
import CreateGroupUrl from 'screens/CreateGroup/CreateGroupUrl'
import CreateGroupPurpose from 'screens/CreateGroup/CreateGroupPurpose'
import CreateGroupVisibilityAccessibility from 'screens/CreateGroup/CreateGroupVisibilityAccessibility'
import CreateGroupParentGroups from 'screens/CreateGroup/CreateGroupParentGroups'
import CreateGroupReview from 'screens/CreateGroup/CreateGroupReview'
import ButtonNW from 'components/Button/ButtonNW'
import { X } from 'lucide-react-native'

export default function CreateGroup ({ navigation }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const keyboardVisible = useKeyboardVisible()
  const confirmDiscardChanges = useConfirmDiscardChanges()
  const { currentStep, goNext, goBack, disableContinue, clearStore, setSubmit } = useCreateGroupStore()
  const [{ currentUser }] = useCurrentUser()
  const memberships = currentUser?.memberships

  const hasParentGroupOptions = memberships?.some(
    (m) => m.hasModeratorRole || m.group.accessibility === GROUP_ACCESSIBILITY.Open
  )

  const screens = [
    CreateGroupName,
    CreateGroupUrl,
    CreateGroupPurpose,
    CreateGroupVisibilityAccessibility,
    hasParentGroupOptions && CreateGroupParentGroups,
    CreateGroupReview
  ].filter(Boolean) // Removes falsy values

  const CurrentScreen = screens[currentStep]
  const totalSteps = screens.length

  const handleCancel = () => {
    const onDiscard = () => {
      clearStore()
      navigation.goBack()
    }
    confirmDiscardChanges({ onDiscard })
  }

  return (
    <KeyboardAvoidingView behavior={isIOS ? 'padding' : ''} style={{ flex: 1 }} enabled>
      <View style={[
        styles.header,
        {
          paddingTop: insets.top,
          paddingBottom: 10
        }]
      }>
        <X onPress={handleCancel} />
        <Text>{`${currentStep + 1}/${totalSteps}`}</Text>
      </View>
      <ScrollView contentContainerClassName='bg-background' contentContainerStyle={styles.screen} keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <CurrentScreen />
      </ScrollView>
      <View
        style={[
          styles.workflowNav,
          {
            paddingBottom: keyboardVisible ? 10 : insets.bottom,
            paddingLeft: insets.left + 10,
            paddingRight: insets.right + 10,
            paddingTop: 10
          }
        ]}
      >
        <View>
          {currentStep > 0 && (
            <ButtonNW
              text={t('< Back')}
              onPress={() => goBack(navigation)}
              className='border-2 border-foreground/50'
              textClassName='text-foreground'
            />
          )}
        </View>
        {currentStep < totalSteps - 1
          ? (
            <ButtonNW
              text={t('Continue')}
              onPress={() => goNext(totalSteps)}
              disabled={disableContinue}
              className='border-2 border-foreground/50'
              textClassName='text-foreground'
            />
            )
          : (
            <ButtonNW
              text={t('Lets Do This!')}
              onPress={() => setSubmit(true)}
              className='border-2 border-foreground/50'
              textClassName='text-foreground'
            />
            )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
    paddingLeft: 10
  },
  screen: {
    flex: 1,
    padding: 20
  },
  workflowNav: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  }
})
