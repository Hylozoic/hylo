import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import confirmNavigate from 'util/confirmNavigate'
import { modalScreenName } from 'hooks/useIsModalScreen'
import { isContextGroupSlug } from '@hylo/presenters/GroupPresenter'
import { useCurrentGroupSlug } from '@hylo/hooks/useCurrentGroup'
import useCurrentUser from '@hylo/hooks/useCurrentUser'

export default function useChangeToGroup () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroupSlug, setCurrentGroupSlug }] = useCurrentGroupSlug()
  const myMemberships = currentUser?.memberships

  return (groupSlug, confirm = true) => {
    if (!myMemberships) {
      throw new Error('Must provide current user memberships as 2nd parameter')
    }

    if (groupSlug === currentGroupSlug) return

    const canViewGroup = myMemberships.find(m => m.group.slug === groupSlug) || isContextGroupSlug(groupSlug)

    if (canViewGroup) {
      const goToGroup = () => {
        setCurrentGroupSlug(groupSlug)
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
