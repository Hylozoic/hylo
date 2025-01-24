import { useState, useCallback, useEffect, useMemo } from 'react'
import { useMutation, useSubscription, gql } from 'urql'
import { useTranslation } from 'react-i18next'

// the amount to delay before deciding that someone is no longer typing
const MAX_TYPING_PAUSE = 3000

const peopleTypingMutation = gql`
  mutation PeopleTypingMutation($postId: ID, $commentId: ID) {
    peopleTyping(postId: $postId, commentId: $commentId) {
      success
    }
  }
`

const peopleTypingSubscription = gql`
  subscription PeopleTypingMutation($postId: ID, $commentId: ID) {
    peopleTyping(postId: $postId, commentId: $commentId) {
      id
      name
      avatarUrl
    }
  }
`

export const usePeopleTyping = ({ postId, commentId, timerLength = MAX_TYPING_PAUSE }) => {
  const { t } = useTranslation()
  const [typingUsers, setTypingUsers] = useState([])
  const [mutationResult, providedSendTyping] = useMutation(peopleTypingMutation)

  const variables = postId ? { postId } : { commentId }

  // Handle incoming subscription events
  useSubscription(
    { query: peopleTypingSubscription, variables },
    (_, data) => {
      if (data?.peopleTyping) {
        const { id, name } = data.peopleTyping
        setTypingUsers((prevUsers) => {
          const existingUser = prevUsers.find((user) => user.id === id)
          if (existingUser) {
            return prevUsers.map((user) =>
              user.id === id ? { ...user, timestamp: Date.now() } : user
            )
          }
          return [...prevUsers, { id, name, timestamp: Date.now() }]
        })
      }
      return data
    }
  )

  // Clean up users who have stopped typing
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prevUsers) =>
        prevUsers.filter((user) => Date.now() - user.timestamp <= timerLength)
      )
    }, 500)

    return () => clearInterval(interval)
  }, [timerLength])

  const sendTyping = useCallback(() => {
    providedSendTyping(variables)
  }, [providedSendTyping, variables])

  const typingMessage = useMemo(() => {
    if (typingUsers.length === 0) return null

    const names = typingUsers.map((user) => user.name)

    if (names.length === 1) {
      return `${names[0]} ${t('is typing')}...`
    }

    if (names.length > 1) {
      return t('Multiple people are typing')
    }

    return ''
  }, [typingUsers, t])

  return { typingUsers, sendTyping, typingMessage, mutationResult }
}

export default usePeopleTyping
