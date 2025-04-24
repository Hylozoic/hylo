import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native'
import { Shapes, Settings, DoorOpen, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import HyloHTML from 'components/HyloHTML'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'

const TabButton = ({ isSelected, onPress, children }) => (
  <TouchableOpacity
    className={`py-1 px-4 rounded-md border-2 ${
      isSelected 
        ? 'bg-selected border-selected' 
        : 'bg-transparent border-foreground/20'
    }`}
    onPress={onPress}
  >
    <Text className='text-foreground'>{children}</Text>
  </TouchableOpacity>
)

const AboutTab = ({ currentTrack, onEnroll, onLeave }) => {
  const { t } = useTranslation()
  const { bannerUrl, name, description, isEnrolled } = currentTrack

  return (
    <View className='flex-1'>
      <View className='mt-4 w-full shadow-2xl rounded-xl h-[40vh] items-center justify-center'>
        {bannerUrl && (
          <Image 
            source={{ uri: bannerUrl }} 
            className='absolute w-full h-full rounded-xl'
            resizeMode='cover'
          />
        )}
        <Text className='text-white text-4xl font-bold'>{name}</Text>
      </View>
      
      <HyloHTML html={description} />

      {!isEnrolled ? (
        <View className='flex-row gap-2 absolute bottom-0 w-full px-4 py-2 justify-between items-center bg-input rounded-t-md'>
          <Text>{t('Ready to jump in?')}</Text>
          <TouchableOpacity 
            className='bg-selected rounded-md p-2 px-4'
            onPress={onEnroll}
          >
            <Text className='text-foreground'>{t('Enroll')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className='flex-row gap-2 border-2 border-foreground/20 rounded-md p-2 justify-between items-center'>
          <View className='flex-row gap-2 items-center'>
            <Check className='w-4 h-4 text-selected' />
            <Text>{t('You are currently enrolled in this track')}</Text>
          </View>
          <TouchableOpacity 
            className='border-2 border-foreground/20 flex-row gap-2 items-center rounded-md p-2 px-4'
            onPress={onLeave}
          >
            <DoorOpen className='w-4 h-4' />
            <Text>{t('Leave Track')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const ActionsTab = ({ currentTrack, posts = [] }) => {
  return (
    <View className='flex-1'>
      <Text className='text-xl font-bold mb-4'>{currentTrack.actionsName}</Text>
      {posts.map(post => (
        <PostCard 
          key={post.id} 
          post={post} 
          isCurrentAction={currentTrack.currentAction?.id === post.id} 
        />
      ))}
    </View>
  )
}

// Might allow publish/unpublish from mobile...

// const EditTab = ({ currentTrack, posts = [], onAddAction, onOpenSettings }) => {
//   const { t } = useTranslation()

//   return (
//     <View className='flex-1'>
//       <TouchableOpacity
//         className='w-full border-2 border-foreground/20 px-4 py-2 rounded-md flex-row items-center gap-2 justify-center mt-4 mb-4'
//         onPress={onOpenSettings}
//       >
//         <Settings className='w-4 h-4' />
//         <Text>{t('Open Track Settings', { actionName: currentTrack.actionsName.slice(0, -1) })}</Text>
//       </TouchableOpacity>

//       {posts.map(post => (
//         <PostCard key={post.id} post={post} />
//       ))}

//       <TouchableOpacity 
//         className='w-full border-2 border-foreground/20 px-4 py-2 rounded-md items-center mt-4'
//         onPress={onAddAction}
//       >
//         <Text>+ {t('Add {{actionName}}', { actionName: currentTrack.actionsName.slice(0, -1) })}</Text>
//       </TouchableOpacity>
//     </View>
//   )
// }

function TrackDetail({ 
  currentTrack,
  isLoading,
  canEdit,
  posts,
  onEnroll,
  onLeave,
  onAddAction,
  onOpenSettings
}) {
  const { t } = useTranslation()
  const [currentTab, setCurrentTab] = useState('about')

  if (isLoading) return <Loading />
  if (!currentTrack) return <Loading />

  const { isEnrolled } = currentTrack

  return (
    <ScrollView className='flex-1 p-4'>
      <View className='max-w-[750px] mx-auto'>
        {(isEnrolled || canEdit) && (
          <View className='flex-row gap-2 w-full justify-center items-center bg-black/20 rounded-md p-2'>
            <TabButton
              isSelected={currentTab === 'about'}
              onPress={() => setCurrentTab('about')}
            >
              {t('About')}
            </TabButton>

            <TabButton
              isSelected={currentTab === 'actions'}
              onPress={() => setCurrentTab('actions')}
            >
              {currentTrack.actionsName}
            </TabButton>
          </View>
        )}

        {currentTab === 'about' && (
          <AboutTab 
            currentTrack={currentTrack} 
            onEnroll={onEnroll}
            onLeave={onLeave}
          />
        )}

        {currentTab === 'actions' && (
          <ActionsTab 
            currentTrack={currentTrack}
            posts={posts}
          />
        )}
      </View>
    </ScrollView>
  )
}

export default TrackDetail
