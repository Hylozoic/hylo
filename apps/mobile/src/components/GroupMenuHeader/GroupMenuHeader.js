import React, { useState, useEffect } from 'react'
import { Settings, Users, ChevronRight } from 'lucide-react-native'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import FastImage from 'react-native-fast-image'
import Avatar from 'components/Avatar'
import { RESP_ADMINISTRATION } from 'store/constants'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import useHasResponsibility from 'hooks/useHasResponsibility'
import { cn } from '../../util'

export default function GroupMenuHeader ({ group }) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const avatarUrl = group.avatarUrl || DEFAULT_AVATAR
  const bannerUrl = group.bannerUrl || DEFAULT_BANNER
  const [textColor, setTextColor] = useState('background')
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAdmin = hasResponsibility(RESP_ADMINISTRATION)

  useEffect(() => {
    /* 
      TODO: Web has a bunch of code that checks the color of the group background
      image to select a good constrasting color for the text.

      Its very dependent on the DOM, so need to consider a different option for mobile
    */
    setTextColor('primary-foreground')
  }, [bannerUrl])

  return (
    <View className='relative flex flex-col justify-end h-[140px] shadow-md pb-2' testID='group-header'>
      <FastImage
        source={{ uri: bannerUrl }}
        style={{
          height: 146,
          width: '100%',
          position: 'absolute',
          opacity: 0.8,
        }}
      />
      
      {canAdmin && (
        <View className='absolute top-2 right-2'>
          <TouchableOpacity 
            // TODO redesign: make this actually navigate correctly
            onPress={() => navigation.navigate('Group Settings')}
          > 
          <View className='w-6 h-6 drop-shadow-md'>
            <Settings color='white' size={24}/>
          </View>
          </TouchableOpacity>
        </View>
      )}

      <View className='relative flex flex-row items-center text-background ml-2 mr-2 gap-1'>
        <FastImage
          source={{ uri: avatarUrl }}
          style={{
            height: 24,
            width: 24,
            marginRight: 8,
            borderRadius: 4
          }}
        />
        
        <View className={cn(
          'flex flex-col flex-1',
          `text-${textColor} drop-shadow-md`
        )}>
          <Text className='text-xl font-bold m-0 text-white'>
            {group.name}
          </Text>
          
          <TouchableOpacity 
            onPress={() => navigation.navigate('Members', { groupSlug: group.slug })}
            className='flex-row items-center'
          >
            <View className='w-4 h-4 mr-1 align-bottom' >
              <Users color='white' size={16} />
            </View>
            <Text className='text-xs align-middle text-white underline'>
              {t('{{count}} Members', { count: group.memberCount })}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={() => navigation.navigate('About', { groupSlug: group.slug })}
          hitSlop={6}
        >
          <View className='cursor-pointer'>
            <ChevronRight color='white' size={24} strokeWidth={3}/>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )
}