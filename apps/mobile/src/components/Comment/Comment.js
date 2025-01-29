import React, { useMemo, useState } from 'react'
import { Text, View, Alert, TouchableOpacity } from 'react-native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { filter } from 'lodash/fp'
import Clipboard from '@react-native-clipboard/clipboard'
import { TextHelpers } from '@hylo/shared'
import deleteCommentMutation from 'graphql/mutations/deleteCommentMutation'
import useHyloActionSheet from 'hooks/useHyloActionSheet'
import useReactOnEntity from 'urql-shared/hooks/useReactOnEntity'
import useCurrentUser from 'hooks/useCurrentUser'
import useHasResponsibility, { RESP_MANAGE_CONTENT } from 'hooks/useHasResponsibility'
import Avatar from 'components/Avatar'
import EmojiRow from 'components/EmojiRow'
import EmojiPicker from 'components/EmojiPicker'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import styles from './Comment.styles'
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5'
import ImageAttachments from 'components/ImageAttachments'

export default function Comment ({
  comment,
  clearHighlighted,
  showMenu = false,
  groupId,
  highlighted,
  onPress,
  onReply,
  postTitle: providedPostTitle,
  scrollTo,
  setHighlighted,
  showMember,
  style
}) {
  const { t } = useTranslation()
  const [, deleteComment] = useMutation(deleteCommentMutation)
  const { showHyloActionSheet } = useHyloActionSheet()
  const { reactOnEntity, deleteReactionFromEntity } = useReactOnEntity()
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [{ currentUser }] = useCurrentUser()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: !groupId, forCurrentUser: true, groupId  })

  const canModerate = hasResponsibility(RESP_MANAGE_CONTENT)
  const isCreator = currentUser && (comment.creator.id === currentUser.id)
  const { creator, text, createdAt, post: postId } = comment
  const postTitle = useMemo(() => providedPostTitle && TextHelpers.truncateText(providedPostTitle, 40), [providedPostTitle])
  const myReactions = useMemo(() => (comment && comment.myReactions) || [], [comment?.myReactions])
  const myEmojis = myReactions.map((reaction) => reaction.emojiFull)

  const handleReaction = (emojiFull) => reactOnEntity('comment', comment?.id, emojiFull, postId)
  const handleRemoveReaction = (emojiFull) => deleteReactionFromEntity('comment', comment?.id, emojiFull, postId)
  const handleReply = onReply && (() => onReply(comment))
  const handleRemove = (!isCreator && canModerate) && (
    () => Alert.alert(
      t('Moderator: Confirm Delete'),
      t('Are you sure you want to remove this comment?'),
      [
        { text: t('Yes'), onPress: async () => deleteComment({ id: comment.id }) },
        { text: t('Cancel'), style: 'cancel' }
      ]
    )
  )
  const handleDelete = (isCreator) && (
    () => {
      Alert.alert(
        t('Confirm Delete'),
        t('Are you sure you want to delete this comment?'),
        [
          { text: t('Yes'), onPress: () => deleteComment({ id: comment.id }) },
          { text: t('Cancel'), style: 'cancel' }
        ]
      )
    }
  )
  const handleCopy = () => Clipboard.setString(TextHelpers.presentHTMLToText(comment.text))

  const commentMenuActions = [
    [t('Reply'), handleReply, {
      icon: <Icon name='Replies' style={styles.actionSheetIcon} />
    }],
    [t('React'), () => setShowEmojiPicker(!showEmojiPicker), {
      icon: <Icon name='Smiley' style={styles.actionSheetIcon} />
    }],
    [t('Copy'), handleCopy, {
      icon: <FontAwesome5Icon name='copy' style={styles.actionSheetIcon} />
    }],
    [t('Remove'), handleRemove, {
      icon: <FontAwesome5Icon name='trash-alt' style={styles.actionSheetIcon} />,
      destructive: true
    }],
    [t('Delete'), handleDelete, {
      icon: <FontAwesome5Icon name='trash-alt' style={styles.actionSheetIcon} />,
      destructive: true
    }]
  ]

  const showActionSheet = () => {
    setHighlighted()
    scrollTo(0.9)
    showHyloActionSheet(
      { actions: commentMenuActions },
      action => {
        if (action[0] !== t('Reply')) clearHighlighted()
      }
    )
  }

  // TODO: URQL - Make CommentPresenter
  const images = filter({ type: 'image' }, comment?.attachments)
    .map(image => ({ uri: image.url }))

  const handleOnPress = () => {
    if (onPress) return onPress()
    // return handleReply()
  }

  return (
    <TouchableOpacity onPress={handleOnPress} onLongPress={showActionSheet}>
      <View style={[styles.container, highlighted && styles.highlighted, style]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => showMember(creator.id)}>
            <Avatar avatarUrl={creator.avatarUrl} style={styles.avatar} />
          </TouchableOpacity>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => showMember(creator.id)}>
              <Text style={styles.name}>{creator.name}</Text>
            </TouchableOpacity>
            <Text style={styles.date}>{TextHelpers.humanDate(createdAt)}</Text>
            {postTitle && (
              <Text style={styles.date}>{t('on')} "{postTitle}"</Text>
            )}
          </View>
          <View style={styles.headerMiddle} />
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.replyLink}
              hitSlop={{ top: 15, left: 10, bottom: 20, right: 10 }}
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Icon style={styles.replyLinkIcon} name='Smiley' />
            </TouchableOpacity>
            {handleReply && (
              <TouchableOpacity
                style={styles.replyLink}
                hitSlop={{ top: 15, left: 10, bottom: 20, right: 10 }}
                onPress={handleReply}
              >
                <Icon style={styles.replyLinkIcon} name='Replies' />
              </TouchableOpacity>
            )}
            {(showMenu || isCreator) && (
              <TouchableOpacity
                onPress={showActionSheet}
                hitSlop={{ top: 20, bottom: 10, left: 0, right: 15 }}
              >
                <Icon name='More' style={styles.menuIcon} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <ImageAttachments
          creator={comment.creator}
          images={images}
          firstImageStyle={styles.imageAttachment}
          title={TextHelpers.presentHTMLToText(comment.text, { truncate: 100 })}
        />
        <View style={styles.body}>
          <HyloHTML html={text} />
          <EmojiRow
            includePicker={false}
            currentUser={currentUser}
            comment={comment}
          />
          {showEmojiPicker && (
            <EmojiPicker
              useModal
              myEmojis={myEmojis}
              modalOpened={showEmojiPicker}
              handleReaction={handleReaction}
              onRequestClose={() => setShowEmojiPicker(!showEmojiPicker)}
              handleRemoveReaction={handleRemoveReaction}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}
