import React from 'react'
import { Text, View } from 'react-native'
import Avatar from 'components/Avatar'
import styles from './NotificationCard.styles'

export default function NotificationCard ({ notification }) {
  const {
    actor,
    avatarSeparator,
    body,
    group,
    createdAt,
    header,
    objectName,
    title,
    unread
  } = notification
  const unreadStyle = unread ? styles.unreadContainer : null
  const unreadTextStyle = unread ? styles.unreadText : null

  return (
    <View style={[ styles.container, unreadStyle ]}>
      <View style={avatarSeparator ? styles.separator : null}>
        <Avatar avatarUrl={actor.avatarUrl} style={styles.avatar} />
      </View>
      <View style={styles.content}>
        <Text numberOfLines={2} style={[ styles.header, unreadTextStyle ]}>
          {unread && (
            <Text style={styles.badge}>● </Text>
          )}
          {notification?.nameInHeader && (
            <Text style={[ styles.name, unreadTextStyle ]}>{notification?.actor.name} </Text>
          )}
          <Text style={[styles.title, unreadTextStyle]}>{header}</Text>
          {title && (
            <Text style={[ styles.title, unreadTextStyle ]} numberOfLines={2}> "{title}"</Text>
          )}
          {objectName && (
            <Text style={[ styles.title, unreadTextStyle ]}> {objectName}</Text>
          )}
        </Text>
        <Text style={[ styles.text, unreadTextStyle ]}>
          <Text style={[ styles.name, unreadTextStyle ]}>{`${actor?.name.split(' ')[0]} `}</Text>
          {body}
          {group && (
            <Text style={[ styles.group, unreadTextStyle ]}> { group }</Text>
          )}
        </Text>
        <Text style={styles.date}>{createdAt}</Text>
      </View>
    </View>
  )
}
