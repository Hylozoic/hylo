import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import FastImage from 'react-native-fast-image'
import LinearGradient from 'react-native-linear-gradient'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { firstName as getFirstName } from '@hylo/presenters/PersonPresenter'
import { isIOS } from 'util/platform'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import { bannerlinearGradientColors, capeCod40, capeCod10, white } from 'style/colors'

export default function StreamHeader ({ image, icon, name, postPrompt = false, currentGroup, streamType }) {
  return (
    <View style={[styles.bannerContainer, postPrompt && styles.bannerContainerWithPostPrompt]}>
      <FastImage source={image} style={styles.image} />
      <LinearGradient style={styles.gradient} colors={bannerlinearGradientColors} />
      <View style={styles.titleRow}>
        <View style={styles.title}>
          {icon && (
            <View style={styles.customViewIconContainer}>
              <Icon name={icon} style={styles.customViewIcon} />
            </View>
          )}
          <Text style={styles.name} numberOfLines={3}>{name}</Text>
        </View>
      </View>
      {postPrompt && <PostPrompt forGroup={currentGroup} currentType={streamType} />}
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
    <View style={styles.postPrompt}>
      <TouchableOpacity onPress={handleOpenPostEditor} style={styles.promptButton}>
        <Avatar avatarUrl={currentUser.avatarUrl} style={styles.avatar} />
        <Text style={styles.promptText}>{postPromptString(currentType, currentUser, t)}</Text>
      </TouchableOpacity>
    </View>
  )
}

export function postPromptString (type = '', user, t) {
  const firstName = getFirstName(user)
  const postPrompts = {
    offer: t('Hi {{firstName}}, what would you like to share?', { firstName }),
    request: t('Hi {{firstName}}, what are you looking for?', { firstName }),
    project: t('Hi {{firstName}}, what would you like to create?', { firstName }),
    event: t('Hi {{firstName}}, want to create an event?', { firstName }),
    default: t('Hi {{firstName}}, press here to post', { firstName })
  }
  return postPrompts[type] || postPrompts.default
}

const postPromptShape = {
  position: 'absolute',
  height: 52,
  borderRadius: 2,
  left: 0,
  right: 0,
  bottom: -26
}

const hasTextShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.25)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 7
}

const styles = StyleSheet.create({
  bannerContainer: {
    zIndex: 10,
    height: 142,
    marginBottom: 10,
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-end'
  },
  bannerContainerWithPostPrompt: {
    marginBottom: 34
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
    backgroundColor: 'rgb(255, 255, 255)'
  },
  image: {
    height: 142,
    width: '100%',
    position: 'absolute'
  },
  gradient: {
    height: 142,
    width: '100%',
    position: 'absolute'
  },
  titleRow: {
    position: 'absolute',
    left: 0,
    bottom: 56,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end'
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
    ...postPromptShape,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: white,
    borderWidth: isIOS ? 0 : 1,
    borderColor: capeCod10
  },
  promptButton: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    marginRight: 10
  },
  promptText: {
    color: capeCod40,
    fontSize: 14
  }
})
