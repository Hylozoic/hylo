import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { TextHelpers } from '@hylo/shared'
import HyloHTML from 'components/HyloHTML'
import Avatar from 'components/Avatar'
import { alabaster, capeCod, rhino30 } from 'style/colors'

export default function MessageCard ({ message }) {
  if (!message) return null

  const { createdAt, creator, suppressCreator, suppressDate, text } = message
  // TODO: Markdown is being used on both Web and Mobile as some messages are HTML
  //       and others are plain text with purposeful linebreaks.
  const messageHTML = TextHelpers.markdown(text)

  return (
    <View style={[styles.container, suppressCreator && styles.padLeftNoAvatar]}>
      <View style={styles.header}>
        {!suppressCreator && (
          <View style={styles.person}>
            <Avatar style={styles.avatar} avatarUrl={creator.avatarUrl} />
            <Text style={styles.name}>{creator.name}</Text>
          </View>
        )}
        {!suppressDate && (
          <Text style={styles.date}>{TextHelpers.humanDate(createdAt)}</Text>
        )}
      </View>
      <View style={[styles.message]}>
        <HyloHTML html={messageHTML} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: alabaster // flag-messages-background-color
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  person: {
    flexDirection: 'row',
    flex: 1
  },
  avatar: {
    marginRight: 8
  },
  date: {
    fontSize: 12,
    color: rhino30,
    fontFamily: 'Circular-Book'
  },
  name: {
    color: capeCod,
    fontFamily: 'Circular-Bold'
  },
  padLeftNoAvatar: {
    // paddingLeft: 44
  },
  message: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    flex: 0.9,
    paddingLeft: 44,
    // marginTop: -10
  },
})
