// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

import React from 'react'
import { View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
// DEPRECATED: lucide-react-native removed
// import { PenSquare, Users } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function CreationOptions () {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()

  return (
    <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
      <View
        className='flex-1 background-opacity-0.3 justify-end'
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      >
        <View
          className='bg-background'
          style={{ paddingBottom: insets.bottom + 40, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
        >
          <TouchableOpacity
            onPress={() => navigation.replace('Edit Post')}
            className='bg-card rounded-lg p-3 m-5 mb-0 border-2 border-foreground/20'
          >
            <View className='flex-row items-center gap-3'>
              <PenSquare size={24} className='text-foreground' />
              <View>
                <Text className='text-lg font-bold text-foreground'>
                  {t('Create Post')}
                </Text>
                <Text className='text-sm text-foreground/60'>
                  {t('Share updates, events, offers, or requests')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.replace('Create Group')}
            className='bg-card rounded-lg p-3 m-5 border-2 border-foreground/20'
          >
            <View className='flex-row items-center gap-3'>
              <Users size={24} className='text-foreground' />
              <View>
                <Text className='text-lg font-bold text-foreground'>
                  {t('Create Group')}
                </Text>
                <Text className='text-sm text-foreground/60'>
                  {t('Start a new community or project')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  )
}
