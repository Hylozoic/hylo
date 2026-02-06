// DEPRECATED: This component is only used by deprecated screens (Stream, Tracks, etc.)
// Kept for reference only.

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import FastImage from 'react-native-fast-image'
// DEPRECATED: react-native-linear-gradient removed
// import LinearGradient from 'react-native-linear-gradient'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import Icon from 'components/Icon'
import LucideIcon from 'components/LucideIcon'
import { bannerlinearGradientColors, white, rhino, black, twBackground } from '@hylo/presenters/colors'
// DEPRECATED: lucide-react-native removed
// import { Plus } from 'lucide-react-native'

export default function StreamHeader ({ image, icon, iconName,name, postPrompt = false, currentGroup, streamType }) {
  return (
    <View style={styles.headerContainer}>
      <FastImage source={image} style={styles.image} />
      {/* DEPRECATED: LinearGradient removed */}
      {/* <LinearGradient style={styles.gradient} colors={bannerlinearGradientColors} /> */}
      <View style={styles.gradient} />
      <View style={styles.header}>
        <View style={styles.title}>
          {icon && (
            <View style={styles.customViewIconContainer}>
              <Icon name={icon} style={styles.customViewIcon} />
            </View>
          )}
          {iconName && (
            <View style={styles.customViewIconContainer}>
              <LucideIcon name={iconName} size={20} />
            </View>
          )}
          <Text style={styles.name} numberOfLines={3}>{name}</Text>
        </View>
        {postPrompt && (
          <PostPrompt forGroup={currentGroup} currentType={streamType} />
        )}
      </View>
    </View>
  )
}

export function PostPrompt ({ forGroup, currentType, currentTopicName }) {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const [{ currentUser }] = useCurrentUser()

  if (!currentUser) return null

  const handleOpenPostEditor = () => {
    navigation.navigate('Edit Post', {
      type: currentType,
      groupId: forGroup.id,
      topicName: currentTopicName
    })
  }

  return (
    <TouchableOpacity className='flex-row rounded-lg p-2 bg-primary opacity-90' style={styles.postPrompt} onPress={handleOpenPostEditor}>
      <Plus style={{ color: rhino }} size={20} />
      <Text style={{ marginRight: 5 }} className='text-l'>{t('Create')}</Text>
    </TouchableOpacity>
  )
}

const hasTextShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.25)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 7
}

const styles = StyleSheet.create({
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  customViewIcon: {
    fontSize: 16,
    color: 'rgba(44, 64, 89, 0.6)'
  },
  customViewIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 25,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: twBackground
  },
  image: {
    height: '100%',
    width: '100%',
    position: 'absolute',
    opacity: 0.8
  },
  gradient: {
    width: '100%',
    position: 'absolute'
  },
  header: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    flex: 1,
    flexDirection: 'row'
  },
  name: {
    fontSize: 24,
    fontFamily: 'Circular-Black',
    color: white,
    textAlign: 'left',
    backgroundColor: 'transparent',
    ...hasTextShadow
  },
  postPrompt: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    fontColor: black
  }

})
