import React from 'react'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { isContextGroupSlug, PUBLIC_GROUP_ID } from '@hylo/presenters/GroupPresenter'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import ContextMenu from 'navigation/menus/ContextMenu'

export default function GroupNavigation () {
  const navigation = useNavigation()
  const { myHome, groupSlug } = useRouteParams()
  const [{ currentGroup, fetching }] = useCurrentGroup({ setToGroupSlug: groupSlug })

  useFocusEffect(() => {
    navigation.setOptions({ title: myHome ? t('My Home') : currentGroup?.name })
  })


  return (
    <ContextMenu />
  )
}

