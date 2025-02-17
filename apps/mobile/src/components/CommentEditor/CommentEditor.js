import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { isEmpty } from 'lodash/fp'
import { isIOS } from 'util/platform'
import MaterialIcon from 'react-native-vector-icons/MaterialIcons'
import { AnalyticsEvents, TextHelpers } from '@hylo/shared'
import createCommentMutation from '@hylo/graphql/mutations/createCommentMutation'
import { firstName } from '@hylo/presenters/PersonPresenter'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import mixpanel from 'services/mixpanel'
import useIsModalScreen from 'hooks/useIsModalScreen'
import HyloEditorWebView from 'components/HyloEditorWebView'
import Icon from 'components/Icon'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import { white, rhino80, gunsmoke, rhino10, amaranth, alabaster, caribbeanGreen } from 'style/colors'

export const CommentEditor = React.forwardRef(({
  post,
  replyingTo,
  scrollToReplyingTo,
  clearReplyingTo
}, ref) => {
  const isModal = useIsModalScreen()
  const safeAreaInsets = useSafeAreaInsets()
  const { t } = useTranslation()
  const [, createComment] = useMutation(createCommentMutation)
  const [hasContent, setHasContent] = useState()
  const editorRef = useRef()
  const [submitting, setSubmitting] = useState()

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
      mixpanel.track(AnalyticsEvents.COMMENT_CREATED, {
        commentLength: TextHelpers.textLengthHTML(commentHTML),
        groupId: post.groups.map(g => g.id),
        hasAttachments: false,
        parentCommentId,
        postId
      })

      setSubmitting(false)
      if (error) Alert.alert(t('Your comment couldnt be saved please try again'))
      else handleDone()
    }
  }, [handleDone, post, replyingTo])

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
      <ScrollView contentContainerStyle={[styles.editor, { paddingBottom: isModal ? safeAreaInsets.bottom : 8 }]}>
        <HyloEditorWebView
          placeholder={t('Write a comment')}
          readOnly={submitting}
          ref={setEditorRef}
          widthOffset={isIOS ? 34 : 38}
          containerStyle={styles.htmlEditor}
          customEditorCSS='max-height: 200px; overflow-y: auto;'
        />
        <TouchableOpacity onPress={handleCreateComment} disabled={!hasContent}>
          {submitting ? <ActivityIndicator /> : <MaterialIcon name='send' size={26} style={[styles.submitButton, hasContent && styles.activeButton]} />}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardFriendlyView>
  )
})

export default CommentEditor

const styles = StyleSheet.create({
  container: {
    backgroundColor: alabaster
  },

  editor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8
  },

  htmlEditor: {
    minHeight: 44,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 10
  },

  prompt: {
    borderTopWidth: 1,
    borderColor: rhino10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },

  promptText: {
    color: rhino80,
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
    fontSize: 26,
    lineHeight: 24,
    marginLeft: 8,
    marginRight: 4,
    color: gunsmoke
  },

  activeButton: {
    color: caribbeanGreen
  }
})

// export const KeyboardAccessoryCommentEditor = React.forwardRef(({
//   renderScrollable,
//   isModal,
//   ...commentFormProps
// }, ref) => {
//   const safeAreaInsets = useSafeAreaInsets()

//   return (
//     <BottomTabBarHeightContext.Consumer>
//       {actualTabBarHeight => {
//         const tabBarHeight = (isModal || !actualTabBarHeight) ? 0 : actualTabBarHeight

//         return (
//           <KeyboardAccessoryView
//             contentContainerStyle={{
//               ...styles.keyboardAccessoryContainerStyle,
//               paddingBottom: isModal ? safeAreaInsets.bottom : 0
//             }}
//             // These offsets are needed for iOS as it seems the tabbar may
//             // be included in the calculations before it is hidden.
//             spaceBetweenKeyboardAndAccessoryView={isIOS ? -tabBarHeight : 0}
//             contentOffsetKeyboardOpened={isIOS ? -tabBarHeight : 0}
//             renderScrollable={renderScrollable}
//           >
//             <CommentEditor {...commentFormProps} ref={ref} />
//           </KeyboardAccessoryView>
//         )
//       }}
//     </BottomTabBarHeightContext.Consumer>
//   )
// })
