import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import confirmNavigate from 'util/confirmNavigate'
import useCurrentGroup, { useGroup } from 'hooks/useCurrentGroup'
import useCurrentUser from 'hooks/useCurrentUser'
import GroupPresenter, { ALL_GROUP_ID, PUBLIC_GROUP_ID } from 'urql-shared/presenters/GroupPresenter'
import { modalScreenName } from 'hooks/useIsModalScreen'
import { WidgetHelpers, NavigatorHelpers } from '@hylo/shared'
import setCurrentGroupSlug from 'store/actions/setCurrentGroupSlug'

const { findHomeView } = WidgetHelpers
const { widgetToMobileNavObject } = NavigatorHelpers

export default function TuseChangeToGroup () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  
  const myMemberships = currentUser?.memberships
  
  return (groupSlug, confirm = true, destinationGroup) => {
    if (!myMemberships) {
      throw new Error('Must provide current user memberships as 2nd parameter')
    }

    if (groupSlug === currentGroup?.slug) return

    const canViewGroup = myMemberships.find(m => m.group.slug === groupSlug) ||
      [PUBLIC_GROUP_ID, ALL_GROUP_ID].includes(groupSlug)

    if (canViewGroup) {
      const goToGroup = () => {
        dispatch(setCurrentGroupSlug(groupSlug))
        
        if (destinationGroup) {
          const homeView = findHomeView(destinationGroup)
          const navArgs = widgetToMobileNavObject({ widget: homeView, destinationGroup })
          if (navArgs) {
            navigation.navigate(...navArgs)
          } else {
            console.warning('Navigation error!', navArgs)
            navigation.navigate('Home Tab', {screen: 'Chat', topicName: 'general'})
          }
        }
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
