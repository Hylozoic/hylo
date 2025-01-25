import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { TextHelpers } from '@hylo/shared'
import HyloHTML from 'components/HyloHTML'
import Avatar from 'components/Avatar'
import { alabaster, capeCod, rhino30 } from 'style/colors'

export default function MessageCard ({ message }) {
  const { createdAt, creator, suppressCreator, suppressDate, text } = message
  // TODO: Markdown is being used on both Web and Mobile as some messages are HTML
  //       and others are plain text with purposeful linebreaks.
  const messageHTML = TextHelpers.markdown(text)

  return (
    <View style={[styles.container, suppressCreator && styles.padLeftNoAvatar]}>
      {!suppressCreator && (
        <Avatar avatarUrl={creator.avatarUrl} />
      )}
      <View style={[styles.body, suppressCreator && styles.padTopNoCreator]}>
        {!suppressCreator && (
          <Text style={styles.name}>{creator.name}</Text>
        )}
        <HyloHTML html={messageHTML} />
        {!suppressDate && (
          <Text style={styles.date}>{createdAt}</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    flexDirection: 'column',
    flex: 0.9,
    paddingLeft: 10
  },
  container: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: alabaster // flag-messages-background-color
  },
  date: {
    fontSize: 12,
    color: rhino30,
    fontFamily: 'Circular-Book',
    marginTop: -8
  },
  name: {
    color: capeCod,
    fontFamily: 'Circular-Bold'
  },
  padTopNoCreator: {
    paddingTop: 0,
    marginTop: 0
  },
  padLeftNoAvatar: {
    paddingLeft: 44
  }
})
