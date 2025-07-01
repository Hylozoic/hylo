import React from 'react'
import { View, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import HyloHTML from 'components/HyloHTML'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { TextHelpers } from '@hylo/shared'

export default function GroupWelcomePage() {
  const insets = useSafeAreaInsets()
  const [{ currentGroup }] = useCurrentGroup()

  return (
    <ScrollView 
      className='flex-1 bg-background'
      contentContainerStyle={{
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right
      }}
    >
      <View className='p-4'>
        <HyloHTML 
          html={TextHelpers.markdown(currentGroup.welcomePage)}
        />
      </View>
    </ScrollView>
  )
}
