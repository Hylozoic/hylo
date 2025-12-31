// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

import React, { useRef, useEffect } from 'react'
import { View } from 'react-native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import ContextSwitchMenu from 'components/ContextSwitchMenu'
import LoadingScreen from 'screens/LoadingScreen'
import Loading from 'components/Loading'
import { useChangeToGroup } from 'hooks/useHandleCurrentGroup'

export default function NoContextFallbackScreen () {
  const [{ currentGroup, fetching }] = useCurrentGroup()
  const changeToGroup = useChangeToGroup()
  const timerRef = useRef(null)
  const prevSlugRef = useRef(currentGroup?.slug)

  // If we're fetching or we have a currentGroup, show loading
  useEffect(() => {
    if (currentGroup?.slug) {
      if (prevSlugRef.current !== currentGroup.slug) {
        prevSlugRef.current = currentGroup.slug
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          // If still on this screen and slug is present, navigate
          changeToGroup(currentGroup.slug, { navigateHome: true })
        }, 5000)
      }
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      prevSlugRef.current = null
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [currentGroup?.slug, changeToGroup])
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