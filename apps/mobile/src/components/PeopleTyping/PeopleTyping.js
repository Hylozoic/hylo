import React, { forwardRef, useImperativeHandle } from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { usePeopleTyping } from '@hylo/hooks/usePeopleTyping'
import { rhino30 } from '@hylo/presenters/colors'

const PeopleTyping = forwardRef(({ messageThreadId, postId, commentId }, ref) => {
  const { sendTyping, typingMessage } = usePeopleTyping({ messageThreadId, postId, commentId })

  // Expose sendTyping via ref for parent component
  useImperativeHandle(ref, () => ({
    sendTyping
  }))

  if (!typingMessage) return null

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{typingMessage}</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    marginHorizontal: 10,
    marginVertical: 5
  },
  message: {
    color: rhino30,
    fontFamily: 'Circular-Book',
    fontSize: 11
  }
})

export default PeopleTyping
