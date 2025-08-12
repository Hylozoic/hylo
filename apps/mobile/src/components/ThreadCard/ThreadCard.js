import React from 'react'
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import { filter, get, map, find, isEmpty } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import Avatar from 'components/Avatar'
import { useTranslation } from 'react-i18next'
import { rhino30, limedSpruce, nevada, rhino60, rhino, rhino10, persimmon, twBackground } from '@hylo/presenters/colors'

const MAX_THREAD_PREVIEW_LENGTH = 55

export default function ThreadCard ({ message, currentUser, onPress, participants, isLast, unreadCount }) {
  if (!message) return null

  const latestMessagePreview = TextHelpers.presentHTMLToText(message?.text, {
    truncate: MAX_THREAD_PREVIEW_LENGTH
  })
  const otherParticipants = filter(p => p.id !== get('id', currentUser), participants)
  const names = threadNames(map('name', otherParticipants))
  const messageCreatorPrepend = lastMessageCreator(message, currentUser, participants)
  const avatarUrls = isEmpty(otherParticipants)
    ? [get('avatarUrl', currentUser)]
    : map('avatarUrl', otherParticipants)

  return (
    <TouchableOpacity onPress={onPress} style={styles.threadCard}>
      <ThreadAvatars avatarUrls={avatarUrls} />
      <View style={[styles.messageContent, isLast && styles.lastCard]}>
        <Text style={styles.header}>{names}</Text>
        <Text style={styles.body} numberOfLines={2}>{messageCreatorPrepend}{latestMessagePreview}</Text>
        <Text style={styles.date}>{TextHelpers.humanDate(message?.createdAt)}</Text>
      </View>
      {!!unreadCount && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

export function lastMessageCreator (message, currentUser, participants) {
  const { t } = useTranslation()
  if (get('id', message.creator) === currentUser.id) return `${t('You')}: `
  if (participants.length <= 2) return ''
  return (find(p => p.id === get('id', message.creator), participants)?.name || t('Deleted User')) + ': '
}

export function threadNames (names) {
  const { t } = useTranslation()
  const l = names.length
  switch (l) {
    case 0:
      return t('You')
    case 1:
    case 2:
      return names.join(', ')
    default:
      return `${names.slice(0, 1).join(', ')} ${t('and')} ${l - 1} ${t('other')}${l > 2 ? 's' : ''}`
  }
}

export function ThreadAvatars ({ avatarUrls }) {
  const count = avatarUrls.length
  return (
    <View style={styles.threadAvatars}>
      {count <= 2 && (
        <Avatar avatarUrl={avatarUrls[0]} style={styles.firstThreadAvatar} />
      )}
      {count === 2 && (
        <Avatar avatarUrl={avatarUrls[1]} style={styles.restThreadAvatars} />
      )}
      {count > 2 && (
        <Avatar avatarUrl={avatarUrls[0]} style={styles.firstThreadAvatar} />
      )}
      {count > 2 && (
        <Avatar avatarUrl={avatarUrls[1]} style={styles.restThreadAvatars} />
      )}
      {count > 3 && (
        <View style={styles.count}><Text style={styles.countText}>+{count - 2}</Text></View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  threadCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    backgroundColor: twBackground, // flag-messages-background-color
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: rhino30
  },
  lastCard: {
    borderColor: '#FFF'
  },
  messageContent: {
    flex: 1,
    paddingBottom: 20
  },
  header: {
    marginTop: 7,
    fontFamily: 'Circular-Bold',
    color: limedSpruce,
    fontSize: 14,
    marginBottom: 3
  },
  body: {
    marginRight: 30,
    fontFamily: 'Circular-Book',
    color: nevada,
    fontSize: 14
  },
  date: {
    fontFamily: 'Circular-Book',
    color: rhino60,
    fontSize: 12
  },
  badge: {
    backgroundColor: persimmon,
    marginRight: 10,
    height: 26,
    width: 26,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: {
    color: 'white',
    fontSize: 14
  },
  footer: {
    fontSize: 12
  },
  threadAvatars: {
    alignSelf: 'flex-start',
    marginRight: 3
  },
  count: {
    backgroundColor: rhino,
    borderRadius: 100,
    height: 34,
    width: 34,
    marginTop: -20,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  countText: {
    color: rhino10, // flag-messages-background-color
    textAlign: 'center',
    fontFamily: 'Circular-Bold',
    overflow: 'hidden',
    backgroundColor: 'transparent'
  },
  firstThreadAvatar: {
    marginLeft: 10,
    marginTop: 10,
    marginRight: 8
  },
  restThreadAvatars: {
    marginLeft: 10,
    marginTop: -20,
    marginRight: 8
  }
})
