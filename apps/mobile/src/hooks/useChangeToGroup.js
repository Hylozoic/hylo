import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import confirmNavigate from 'util/confirmNavigate'
import { modalScreenName } from 'hooks/useIsModalScreen'
import { isContextGroup } from 'frontend-shared/presenters/GroupPresenter'
import { useCurrentGroupSlug } from 'frontend-shared/hooks/useCurrentGroup'
import useCurrentUser from 'frontend-shared/hooks/useCurrentUser'

export default function useChangeToGroup () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroupSlug }] = useCurrentGroupSlug()
  const myMemberships = currentUser?.memberships

  return (groupSlug, confirm = true) => {
    if (!myMemberships) {
      throw new Error('Must provide current user memberships as 2nd parameter')
    }

    if (groupSlug === currentGroupSlug) return

    const canViewGroup = myMemberships.find(m => m.group.slug === groupSlug)
      || isContextGroup(groupSlug)

    if (canViewGroup) {
      const goToGroup = () => {
        navigation.navigate('Group Navigation', { groupSlug })
        navigation.navigate('Stream', { initial: false })
      }

      confirm
        ? confirmNavigate(goToGroup, {
          title: t('Changing Groups'),
          confirmationMessage: t('Do you want to change context to this other group?')
        })
        : goToGroup()
    } else {
      navigation.navigate(modalScreenName('Group Explore'), { groupSlug })
    }
  }
}
