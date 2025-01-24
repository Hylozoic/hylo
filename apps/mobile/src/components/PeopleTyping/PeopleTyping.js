import React, { forwardRef, useImperativeHandle } from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { usePeopleTyping } from 'urql-shared/hooks/usePeopleTyping'
import { rhino30 } from 'style/colors'

const PeopleTyping = forwardRef(({ postId, commentId }, ref) => {
  const { sendTyping, typingMessage } = usePeopleTyping({ postId, commentId })

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
