import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { PenSquare, Users } from 'lucide-react-native'
import { openURL } from 'hooks/useOpenURL'

export default function CreationOptions () {
  const { t } = useTranslation()
  const handleCreatePost = () => {
    openURL('/create/post')
  }
  const handleCreateGroup = () => {
    openURL('/create/group')
  }

  return (
    <View className='flex-1 justify-center bg-background p-4 gap-4'>
      <TouchableOpacity
        onPress={handleCreatePost}
        className='bg-card rounded-lg p-6 border-2 border-foreground/20'
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
        onPress={handleCreateGroup}
        className='bg-card rounded-lg p-6 border-2 border-foreground/20'
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
  )
}
