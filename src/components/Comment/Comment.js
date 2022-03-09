/* eslint-disable camelcase */
import React, { useMemo } from 'react'
import { Image, Text, View, Alert, TouchableOpacity } from 'react-native'
import { isEmpty, filter, findLastIndex } from 'lodash/fp'
import { TextHelpers } from 'hylo-shared'
import { openURL } from 'navigation/linking'
import Avatar from 'components/Avatar'
import PopupMenuButton from 'components/PopupMenuButton'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import styles from './Comment.styles'

export default function Comment ({
  comment,
  isCreator,
  canModerate,
  showMember,
  slug,
  style,
  displayPostTitle,
  deleteComment,
  editComment,
  hideMenu,
  onReply,
  onPress: providedOnPress
}) {
  const { creator, text, createdAt, post } = comment
  const presentedText = useMemo(() => TextHelpers.presentHTML(text, { slug }), [text, slug])
  let postTitle = post?.title

  if (displayPostTitle && postTitle) {
    postTitle = TextHelpers.truncateText(postTitle, 40)
  }

  const onPress = providedOnPress || (onReply && (() => onReply(comment, { mention: false })))
  const imageAttachments = filter({ type: 'image' }, comment?.attachments)
  // NOTE: Currently no UI for adding comment file attachments
  // const fileAttachments = filter({ type: 'file' }, comment?.attachments)
  const commentMenuItems = {
    editComment: {
      label: 'Edit Comment',
      action: editComment
    },
    deleteComment: {
      label: 'Delete Comment',
      action: (isCreator && deleteComment) && (
        () => Alert.alert(
          'Confirm Delete',
          'Are you sure you want to delete this comment?',
          [
            { text: 'Yes', onPress: () => deleteComment(comment.id) },
            { text: 'Cancel', style: 'cancel' }
          ]
        )
      ),
      destructive: true
    },
    removeComment: {
      label: 'Remove Comment',
      action: (!isCreator && canModerate && deleteComment) && (
        () => Alert.alert(
          'Moderator: Confirm Delete',
          'Are you sure you want to remove this comment?',
          [
            { text: 'Yes', onPress: () => deleteComment(comment.id) },
            { text: 'Cancel', style: 'cancel' }
          ]
        )
      ),
      destructive: true
    }
  }

  return (
    <TouchableOpacity onPress={onPress}>
      <View style={[styles.container, style]}>
        <TouchableOpacity onPress={() => showMember(creator.id)}>
          <Avatar avatarUrl={creator.avatarUrl} style={styles.avatar} />
        </TouchableOpacity>
        <View style={styles.details}>
          <View style={styles.header}>
            <View style={styles.meta}>
              <TouchableOpacity onPress={() => showMember(creator.id)}>
                <Text style={styles.name}>{creator.name}</Text>
              </TouchableOpacity>
              <Text style={styles.date}>{TextHelpers.humanDate(createdAt)}</Text>
              {displayPostTitle &&
                <Text style={styles.date}>on "{postTitle}"</Text>}
            </View>
            <View style={styles.headerRight}>
              {onReply && (
                <TouchableOpacity style={styles.replyLink} onPress={() => onReply(comment, { mention: !!comment.parentComment })}>
                  <Icon style={styles.replyLinkIcon} name='Reply' />
                  <Text style={styles.replyLinkText}>Reply</Text>
                </TouchableOpacity>
              )}
              {!hideMenu && (
                <CommentMenu menuItems={commentMenuItems} />
              )}
            </View>
          </View>
          {imageAttachments && imageAttachments.map(({ url }, i) => (
            <TouchableOpacity onPress={() => openURL(url)} key={i}>
              <Image source={{ uri: url }} resizeMode='cover' style={styles.imageAttachemnt} />
            </TouchableOpacity>
          ))}
          <HyloHTML
            tagsStyles={{ p: { margin: 0 } }}
            html={presentedText}
          />
        </View>
      </View>
    </TouchableOpacity>
  )
}

export function CommentMenu ({ menuItems: providedMenuItems }) {
  const menuItems = filter(action => action?.action, providedMenuItems)

  if (isEmpty(menuItems)) return null

  const destructiveButtonIndex = findLastIndex(menuItem => menuItem?.destructive, menuItems)
  const actions = menuItems.map(menuItem => ([menuItem.label, menuItem.action]))

  return (
    <PopupMenuButton
      actions={actions}
      hitSlop={{ top: 20, bottom: 10, left: 0, right: 15 }}
      destructiveButtonIndex={destructiveButtonIndex}
    >
      <Icon name='More' style={styles.menuIcon} />
    </PopupMenuButton>
  )
}
