import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import ContextMenu from 'navigation/menus/ContextMenu'

export default function GroupNavigation () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { myHome, groupSlug } = useRouteParams()
  const [{ currentGroup }] = useCurrentGroup({ setToGroupSlug: groupSlug })

  useFocusEffect(() => {
    navigation.setOptions({ title: myHome ? t('My Home') : currentGroup?.name })
  })

  return (
    <ContextMenu />
  )
}
