import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Avatar from 'components/Avatar'
import Colors from '../../style/theme-colors'

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
    <View style={[styles.container, unreadStyle]}>
      <View style={avatarSeparator ? styles.separator : null}>
        <Avatar avatarUrl={actor.avatarUrl} style={styles.avatar} />
      </View>
      <View style={styles.content}>
        <Text numberOfLines={2} style={[styles.header, unreadTextStyle]}>
          {unread && (
            <Text style={styles.badge}>● </Text>
          )}
          {notification?.nameInHeader && (
            <Text style={[styles.name, unreadTextStyle]}>{notification?.actor.name} </Text>
          )}
          <Text style={[styles.title, unreadTextStyle]}>{header}</Text>
          {title && (
            <Text style={[styles.title, unreadTextStyle]} numberOfLines={2}> "{title}"</Text>
          )}
          {objectName && (
            <Text style={[styles.title, unreadTextStyle]}> {objectName}</Text>
          )}
        </Text>
        <Text style={[styles.text, unreadTextStyle]}>
          <Text style={[styles.name, unreadTextStyle]}>{`${actor?.name.split(' ')[0]} `}</Text>
          {body}
          {group && (
            <Text style={[styles.group, unreadTextStyle]}> {group}</Text>
          )}
        </Text>
        <Text style={styles.date}>{createdAt}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    marginLeft: 15,
    marginRight: 15,
    marginTop: 5
  },
  badge: {
    color: Colors.accent,
    fontFamily: 'Circular-Bold',
    fontSize: 12
  },
  container: {
    flexDirection: 'row',
    paddingTop: 15,
    backgroundColor: Colors.foreground10
  },
  unreadContainer: {
    backgroundColor: Colors.background20
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    paddingRight: 15,
    paddingBottom: 15,
    borderBottomColor: Colors.foreground30,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  date: {
    fontSize: 12,
    color: Colors.foreground30,
    fontFamily: 'Circular-Book',
    marginTop: 3
  },
  header: {
    flex: 1,
    flexDirection: 'row'
  },
  name: {
    color: Colors.foreground60,
    fontFamily: 'Circular-Bold',
    fontSize: 14,
    marginTop: 3
  },
  separator: {
    borderBottomColor: Colors.foreground30,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  text: {
    fontFamily: 'Circular-Book',
    fontSize: 14,
    color: Colors.foreground60,
    marginTop: 3
  },
  unreadText: {
    color: Colors.foreground
  },
  title: {
    fontFamily: 'Circular-Bold',
    fontSize: 14,
    color: Colors.foreground60,
    marginTop: 3
  }
})
