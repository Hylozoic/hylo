import React from 'react'
import { View } from 'react-native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import ContextSwitchMenu from 'components/ContextSwitchMenu'
import LoadingScreen from 'screens/LoadingScreen'

export default function NoContextFallbackScreen () {
  const [{ currentGroup, fetching }] = useCurrentGroup()

  // If we're fetching or we have a currentGroup, show loading
    if (fetching || currentGroup?.slug) {
    return <LoadingScreen />
  }

  // Only show the context menu if we truly have no group context
  return (
    !currentGroup?.slug && (
    <View className='flex-1 bg-background'>
      <ContextSwitchMenu
        isExpanded={true}
        setIsExpanded={() => {}}
        fullView={true}
      />
    </View>)
  )
} 