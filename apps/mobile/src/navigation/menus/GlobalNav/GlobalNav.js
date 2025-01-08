import React, { Suspense } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import FastImage from 'react-native-fast-image'
import Icon from 'components/Icon'
import useCurrentUser from 'hooks/useCurrentUser'
import { Globe } from 'lucide-react-native'
import useCurrentGroup from 'hooks/useCurrentGroup'
import { GroupRow } from 'screens/DrawerMenu/DrawerMenu'
import useChangeToGroup from 'hooks/useChangeToGroup'

export default function GlobalNav() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [currentUser] = useCurrentUser()
  const [currentGroup] = useCurrentGroup()
  const memberships = currentUser?.memberships
  const changeToGroup = useChangeToGroup()
  const myGroups = memberships
    .map(m => m.group)
    .sort((a, b) => a.name.localeCompare(b.name))
  
  /* 
    Aspirations for GlobalNav
     - On background touch or on gesture scroll, display tool-tip like popups on each groups name display to the right of each group avatar
     - Reconcile navigation needs between the web GlobalNav and the mobile GlobalNav and its sibling, the BottomNavBar
  */
  return (
    <View className="flex-col h-full bg-background items-center py-2 px-3">
      <View className="flex-1 overflow-y-scroll">
        {myGroups?.map(group => (
          <GroupRow
            key={group.id}
            group={group}
            changeToGroup={changeToGroup}
            currentGroupSlug={currentGroup?.slug}
            addPadding
          />
        ))}
      </View>
    </View>
  )
}
