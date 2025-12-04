import React from 'react'
import { View } from 'react-native'
import ContextMenuComponent from 'components/ContextMenu'

export default function ContextMenu () {
  return (
    <View className='flex-1'>
      <ContextMenuComponent nonDrawer />
    </View>
  )
}
