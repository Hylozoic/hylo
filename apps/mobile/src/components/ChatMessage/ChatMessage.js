import React, { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { DateTimeHelpers } from '@hylo/shared'
import { LongPressGestureHandler, State } from 'react-native-gesture-handler'
import Avatar from 'components/Avatar'
import HyloHTML from 'components/HyloHTML'
import EmojiRow from 'components/EmojiRow'
import { Flag } from 'lucide-react-native'

/**
 * Renders a single chat message with support for reactions, attachments, and interactions
 */
export default function ChatMessage ({
  post,
  currentUser,
  previousPost,
  nextPost,
  highlighted,
  onAddReaction,
  onRemoveReaction,
  onFlagPost,
  onRemovePost,
  onPress
}) {
  const { t } = useTranslation()
  const [showActions, setShowActions] = useState(false)

  // Check if this message should show header (avatar, name, timestamp)
  const showHeader = !previousPost ||
    previousPost.creator?.id !== post.creator?.id ||
    !DateTimeHelpers.isSameDay(previousPost.createdAt, post.createdAt)

  // Check if this is the current user's message
  const isOwnMessage = currentUser?.id === post.creator?.id

  // Format timestamp
  const displayTime = DateTimeHelpers.humanDate(post.createdAt, {
    locale: t('locale'),
    timezone: currentUser?.timezone
  })

  const handleLongPress = useCallback(() => {
    setShowActions(!showActions)
  }, [showActions])

  const onHandlerStateChange = useCallback((event) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      handleLongPress()
    }
  }, [handleLongPress])

  const handleReaction = useCallback((emojiData) => {
    const existingReaction = post.myReactions?.find(r => r.emojiFull === emojiData.colons)

    if (existingReaction) {
      onRemoveReaction?.(post.id, emojiData.colons)
    } else {
      onAddReaction?.(post.id, emojiData)
    }
    setShowActions(false)
  }, [post.id, post.myReactions, onAddReaction, onRemoveReaction])

  const handleFlag = useCallback(() => {
    onFlagPost?.(post.id)
    setShowActions(false)
  }, [post.id, onFlagPost])

  const handleRemove = useCallback(() => {
    onRemovePost?.(post.id)
    setShowActions(false)
  }, [post.id, onRemovePost])

  return (
    <View style={[
      styles.messageContainer,
      highlighted && styles.highlighted,
      isOwnMessage && styles.ownMessage
    ]}
    >
      {/* Message Header */}
      {showHeader && (
        <View style={styles.messageHeader}>
          <Avatar
            person={post.creator}
            size='xs'
            style={styles.avatar}
          />
          <Text style={styles.creatorName}>{post.creator?.name}</Text>
          <Text style={styles.timestamp}>{displayTime}</Text>
        </View>
      )}

      {/* Message Content */}
      <LongPressGestureHandler
        onHandlerStateChange={onHandlerStateChange}
        minDurationMs={500}
      >
        <Pressable
          onPress={onPress}
          style={[
            styles.messageContent,
            !showHeader && styles.messageContentNoHeader,
            isOwnMessage && styles.ownMessageContent
          ]}
        >
          {/* Post Title (for announcement/event posts) */}
          {post.title && (
            <Text style={styles.messageTitle}>{post.title}</Text>
          )}

          {/* Post Details/Text */}
          {post.details && (
            <HyloHTML
              html={post.details}
              style={styles.messageText}
            />
          )}

          {/* Attachments */}
          {post.attachments?.length > 0 && (
            <View style={styles.attachments}>
              {post.attachments.map((attachment, index) => (
                <View key={attachment.id || index} style={styles.attachment}>
                  {/* TODO: Implement attachment rendering based on type */}
                  <Text style={styles.attachmentText}>{attachment.url}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Link Preview */}
          {post.linkPreview && (
            <View style={styles.linkPreview}>
              <Text style={styles.linkPreviewTitle}>{post.linkPreview.title}</Text>
              <Text style={styles.linkPreviewDescription}>{post.linkPreview.description}</Text>
            </View>
          )}
        </Pressable>
      </LongPressGestureHandler>

      {/* Reactions */}
      {post.postReactions?.length > 0 && (
        <EmojiRow
          reactions={post.postReactions}
          onReaction={handleReaction}
          style={styles.reactions}
        />
      )}

      {/* Action Menu */}
      {showActions && (
        <View style={styles.actionMenu}>
          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <Text style={styles.actionText}>{t('React')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleFlag}>
            <Flag size={16} color='#666' />
            <Text style={styles.actionText}>{t('Flag')}</Text>
          </TouchableOpacity>
          {(isOwnMessage || currentUser?.isAdmin) && (
            <TouchableOpacity style={styles.actionButton} onPress={handleRemove}>
              <Text style={[styles.actionText, styles.destructiveAction]}>{t('Remove')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  messageContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: 'transparent'
  },
  highlighted: {
    backgroundColor: '#fff3cd'
  },
  ownMessage: {
    // Could add different styling for own messages
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  avatar: {
    marginRight: 8
  },
  creatorName: {
    fontFamily: 'Circular-Bold',
    fontSize: 14,
    color: '#2C405A',
    marginRight: 8
  },
  timestamp: {
    fontSize: 12,
    color: '#8B96A5',
    marginLeft: 'auto'
  },
  messageContent: {
    marginLeft: 32, // Align with avatar
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12
  },
  messageContentNoHeader: {
    marginTop: 2
  },
  ownMessageContent: {
    backgroundColor: '#007bff',
    marginLeft: 48,
    marginRight: 16
  },
  messageTitle: {
    fontFamily: 'Circular-Bold',
    fontSize: 16,
    color: '#2C405A',
    marginBottom: 4
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2C405A'
  },
  attachments: {
    marginTop: 8
  },
  attachment: {
    backgroundColor: '#e9ecef',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4
  },
  attachmentText: {
    fontSize: 12,
    color: '#6c757d'
  },
  linkPreview: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff'
  },
  linkPreviewTitle: {
    fontFamily: 'Circular-Bold',
    fontSize: 14,
    color: '#2C405A',
    marginBottom: 4
  },
  linkPreviewDescription: {
    fontSize: 12,
    color: '#6c757d'
  },
  reactions: {
    marginLeft: 32,
    marginTop: 4
  },
  actionMenu: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  actionText: {
    fontSize: 14,
    color: '#2C405A',
    marginLeft: 4
  },
  destructiveAction: {
    color: '#dc3545'
  }
})
