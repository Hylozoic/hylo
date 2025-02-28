import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { isContextGroupSlug } from '@hylo/presenters/GroupPresenter'
import { useCurrentGroupSlug } from '@hylo/hooks/useCurrentGroup'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { modalScreenName } from 'hooks/useIsModalScreen'

function confirmNavigate (onConfirm, options = {}) {
  options = {
    title: 'Changing context',
    confirmationMessage: 'You sure you want to navigate away from this area?',
    confirmButtonText: 'Yes',
    cancelButtonText: 'Stay',
    ...options
  }

  Alert.alert(
    options.title,
    options.confirmationMessage,
    [
      { text: options.confirmButtonText, onPress: onConfirm },
      { text: options.cancelButtonText, style: 'cancel' }
    ]
  )
}

export default function useChangeToGroup () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroupSlug, setCurrentGroupSlug }] = useCurrentGroupSlug()
  const myMemberships = currentUser?.memberships

  const changeToGroup = useCallback((groupSlug, confirm = true) => {
    if (groupSlug === currentGroupSlug) return

    const canViewGroup = myMemberships.find(m => m.group.slug === groupSlug) || isContextGroupSlug(groupSlug)

    if (canViewGroup) {
      const goToGroup = () => setCurrentGroupSlug(groupSlug)

      confirm
        ? confirmNavigate(goToGroup, {
          title: t('Changing Groups'),
          confirmationMessage: t('Do you want to change context to this other group?')
        })
        : goToGroup()
    } else {
      navigation.navigate(modalScreenName('Group Explore'), { groupSlug })
    }
  }, [navigation, currentUser, currentGroupSlug, myMemberships])

  return changeToGroup
}
