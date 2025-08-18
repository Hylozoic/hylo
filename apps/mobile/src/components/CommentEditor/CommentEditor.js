import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { isEmpty } from 'lodash/fp'
import { isIOS } from 'util/platform'
import { SendHorizonal } from 'lucide-react-native'
import { AnalyticsEvents, TextHelpers } from '@hylo/shared'
import createCommentMutation from '@hylo/graphql/mutations/createCommentMutation'
import completePostMutation from '@hylo/graphql/mutations/completePostMutation'
import { firstName } from '@hylo/presenters/PersonPresenter'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import mixpanel from 'services/mixpanel'
import { trackWithConsent } from 'services/mixpanel'
import HyloEditorWebView from 'components/HyloEditorWebView'
import Icon from 'components/Icon'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import { gunsmoke, amaranth } from '@hylo/presenters/colors'
import Colors from '../../style/theme-colors'
import useTrack from '@hylo/hooks/useTrack'
import { useToast } from 'components/Toast'
import { getTrackIdFromPath } from '@hylo/navigation'
import useRouteParams from 'hooks/useRouteParams'
import useCurrentUser from '@hylo/hooks/useCurrentUser'

export const CommentEditor = React.forwardRef(({
  isModal,
  post,
  replyingTo,
  scrollToReplyingTo,
  clearReplyingTo
}, ref) => {
  const safeAreaInsets = useSafeAreaInsets()
  const { t } = useTranslation()
  const [, createComment] = useMutation(createCommentMutation)
  const [, completePost] = useMutation(completePostMutation)
  const [hasContent, setHasContent] = useState()
  const editorRef = useRef()
  const [submitting, setSubmitting] = useState()
  const showToast = useToast()
  const { originalLinkingPath } = useRouteParams()
  const trackId = getTrackIdFromPath(originalLinkingPath)
  const [currentTrack, trackQueryInfo, refetchTrack] = useTrack({ trackId })
  const [{ currentUser }] = useCurrentUser()

  const handleDone = useCallback(() => {
    clearReplyingTo()
    editorRef?.current.clearContent()
    editorRef?.current.blur()
  }, [clearReplyingTo])

  const handleCreateComment = useCallback(async () => {
    const commentHTML = editorRef?.current.getHTML()

    if (!isEmpty(commentHTML)) {
      setSubmitting(true)
      const parentCommentId = replyingTo?.parentComment?.id || replyingTo?.id || null
      const postId = post.id
      const { error } = await createComment({ text: commentHTML, parentCommentId, postId })

      // Required check for action posts
      if (!error && post?.type === 'action' && post?.completionAction === 'comment' && !post?.completedAt) {
        const { error: completionError, data } = await completePost({
          postId: post.id,
          completionResponse: ['comment']
        })
        if (completionError) {
          console.error('Failed to complete post:', completionError)
          showToast({
            type: 'error',
            text1: t('Error completing action'),
            text2: completionError.message
          })
        } else {
          // Check if this completion also completes the track
          if (currentTrack && data.completePost) {
            const allActionsCompleted = currentTrack.posts.every(
              action => action.id === post.id || action.completedAt
            )

            if (allActionsCompleted) {
              refetchTrack()
              showToast({
                type: 'success',
                text1: t('You have completed the track: {{trackName}}', { trackName: '' }),
                text2: currentTrack.name,
                visibilityTime: 3000
              })
            } else {
              showToast({
                type: 'success',
                text1: t('Action completed')
              })
            }
          } else {
            showToast({
              type: 'success',
              text1: t('Action completed')
            })
          }
        }
      }

      trackWithConsent(AnalyticsEvents.COMMENT_CREATED, {
        commentLength: TextHelpers.textLengthHTML(commentHTML),
        groupId: post.groups.map(g => g.id),
        hasAttachments: false,
        parentCommentId,
        postId,
        userId: currentUser?.id
      }, currentUser, !currentUser)

      setSubmitting(false)
      if (error) {
        showToast({
          type: 'error',
          text1: t('Your comment couldnt be saved please try again')
        })
      } else handleDone()
    }
  }, [handleDone, post, replyingTo, completePost, currentTrack, showToast, t, currentUser])

  const setEditorRef = useCallback(newEditorRef => {
    setHasContent(!newEditorRef?.isEmpty)
    editorRef.current = newEditorRef
  }, [])

  // This is what is causing the bouncing
  useEffect(() => {
    if (replyingTo?.parentComment) {
      editorRef?.current.setContent(`<p>${TextHelpers.mentionHTML(replyingTo.creator)}&nbsp;</p>`)
      setTimeout(() => editorRef?.current.focus('end'), 100)
    } else {
      editorRef?.current.clearContent()
      // setTimeout(() => editorRef?.current.focus('end'), 100)
    }
  }, [replyingTo?.id, replyingTo?.parentComment, replyingTo?.creator])

  useImperativeHandle(ref, () => ({
    clearContent: () => editorRef?.current.clearContent(),
    focus: () => editorRef?.current.focus(),
    blur: () => editorRef?.current.blur()
  }))

  return (
    <KeyboardFriendlyView style={styles.container}>
      {replyingTo?.creator?.name && (
        <View style={styles.prompt}>
          <TouchableOpacity onPress={handleDone}>
            <Icon name='Ex' style={styles.promptClearIcon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={scrollToReplyingTo}>
            <Text style={styles.promptText}>
              {t('Replying to')} <Text style={styles.promptTextName}>{firstName(replyingTo?.creator)}'s</Text> {t('comment')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView contentContainerStyle={[styles.editor, isModal && { paddingBottom: safeAreaInsets.bottom }]}>
        <HyloEditorWebView
          placeholder={t('Write a comment')}
          readOnly={submitting}
          ref={setEditorRef}
          widthOffset={isIOS ? 34 : 38}
          containerStyle={styles.htmlEditor}
          customEditorCSS='max-height: 200px; overflow-y: auto;'
        />
        <TouchableOpacity onPress={handleCreateComment} disabled={!hasContent}>
          {submitting
            ? (
              <ActivityIndicator />
              )
            : (
              <SendHorizonal size={32} style={[styles.submitButton, hasContent && styles.activeButton]} />
              )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardFriendlyView>
  )
})

export default CommentEditor

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background20
  },

  editor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8
  },

  htmlEditor: {
    minHeight: 44,
    backgroundColor: Colors.background20,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 10
  },

  prompt: {
    borderTopWidth: 1,
    borderColor: Colors.foreground10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },

  promptText: {
    color: Colors.foreground80,
    lineHeight: 22
  },

  promptTextName: {
    fontWeight: 'bold'
  },

  promptClearIcon: {
    marginRight: 5,
    fontSize: 22,
    lineHeight: 20,
    color: amaranth
  },

  submitButton: {
    marginLeft: 8,
    marginRight: 4,
    color: gunsmoke
  },

  activeButton: {
    color: Colors.selected
  }
})
