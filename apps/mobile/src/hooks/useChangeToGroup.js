import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import confirmNavigate from 'util/confirmNavigate'
import useCurrentGroup from 'hooks/useCurrentGroup'
import useCurrentUser from 'hooks/useCurrentUser'
import { ALL_GROUP_ID, PUBLIC_GROUP_ID } from 'urql-shared/presenters/GroupPresenter'
import { modalScreenName } from 'hooks/useIsModalScreen'

export default function useChangeToGroup () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const myMemberships = currentUser?.memberships

  return (groupSlug, confirm = true) => {
    if (!myMemberships) {
      throw new Error('Must provide current user memberships as 2nd parameter')
    }

    if (groupSlug === currentGroup?.slug) return

    const canViewGroup = myMemberships.find(m => m.group.slug === groupSlug) ||
      [PUBLIC_GROUP_ID, ALL_GROUP_ID].includes(groupSlug)

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
