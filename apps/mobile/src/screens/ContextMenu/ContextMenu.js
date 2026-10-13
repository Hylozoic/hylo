// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

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
