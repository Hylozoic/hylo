import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { TextHelpers } from '@hylo/shared'
import HyloHTML from 'components/HyloHTML'
import Avatar from 'components/Avatar'
import { alabaster, capeCod, rhino30 } from 'style/colors'

export default function MessageCard ({ message }) {
  if (!message) return null

  const { creator, displayDate, suppressCreator, text } = message
  // TODO: Markdown is being used on both Web and Mobile as some messages are HTML
  //       and others are plain text with purposeful linebreaks.
  const messageHTML = TextHelpers.markdown(text)

  return (
    <View style={[styles.container, suppressCreator && styles.padLeftNoAvatar]}>
      <View style={[styles.header, suppressCreator && styles.headerWithoutAvatar]}>
        {!suppressCreator && (
          <>
            <View style={styles.person}>
              <Avatar style={styles.avatar} avatarUrl={creator.avatarUrl} />
              <Text style={styles.name}>{creator.name}</Text>
            </View>
            <Text style={styles.date}>{displayDate}</Text>
          </>
        )}
      </View>
      <View style={styles.messageRow}>
        <View style={styles.message}>
          <HyloHTML html={messageHTML} />
        </View>
        {suppressCreator && displayDate && (
          <Text style={styles.dateInline}>{displayDate}</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    paddingHorizontal: 10,
    backgroundColor: alabaster
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerWithoutAvatar: {
    justifyContent: 'flex-end' // Align date to the right if no avatar
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatar: {
    marginRight: 8
  },
  name: {
    color: capeCod,
    fontFamily: 'Circular-Bold'
  },
  date: {
    fontSize: 12,
    color: rhino30,
    fontFamily: 'Circular-Book'
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between' // Ensure text and timestamp stay in one row
  },
  message: {
    flex: 1, // Ensure message takes up the available space
    paddingLeft: 44
  },
  dateInline: {
    fontSize: 12,
    color: rhino30,
    fontFamily: 'Circular-Book',
    marginLeft: 8 // Add spacing to prevent overlap with message text
  }
})
