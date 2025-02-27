import React from 'react'
import { View } from 'react-native'
import useReactOnEntity from 'hooks/useReactOnEntity'
import EmojiPicker from 'components/EmojiPicker'
import EmojiPill from 'components/EmojiPill'

export default function EmojiRow (props) {
  const {
    comment,
    currentUser,
    post,
    includePicker = true
  } = props
  const { reactOnEntity, deleteReactionFromEntity } = useReactOnEntity()

  if (!post && !comment) return null

  const entityType = comment ? 'comment' : 'post'
  const entityId = comment ? comment?.id : post?.id
  // const groupIds = post.groups.map(g => g.id)
  const handleReaction = (emojiFull) => reactOnEntity(entityType, entityId, emojiFull)
  const handleRemoveReaction = (emojiFull) => deleteReactionFromEntity(entityType, entityId, emojiFull)
  const myReactions = (comment ? comment.myReactions : post.myReactions) || []
  const entityReactions = (comment ? comment.commentReactions : post.postReactions) || []
  const myEmojis = myReactions.map((reaction) => reaction.emojiFull)
  const usersReactions = entityReactions.reduce((accum, entityReaction) => {
    if (accum[entityReaction.emojiFull]) {
      const { userList } = accum[entityReaction.emojiFull]
      accum[entityReaction.emojiFull] = { emojiFull: entityReaction.emojiFull, userList: [...userList, entityReaction.user.name] }
    } else {
      accum[entityReaction.emojiFull] = { emojiFull: entityReaction.emojiFull, userList: [entityReaction.user.name] }
    }

    if (myEmojis.includes(entityReaction.emojiFull)) accum[entityReaction.emojiFull] = { ...accum[entityReaction.emojiFull], loggedInUser: true }

    return accum
  }, {})

  if (!entityReactions) {
    return null
  }

  return (
    <View style={styles.footerReactions}>
      {Object.values(usersReactions).map(reaction => (
        <EmojiPill
          onPress={currentUser ? reaction.loggedInUser ? handleRemoveReaction : handleReaction : null}
          key={reaction.emojiFull}
          emojiFull={reaction.emojiFull}
          count={reaction.userList.length}
          selected={reaction.loggedInUser}
          toolTip={reaction.userList.join('<br>')}
        />
      ))}
      {(currentUser && includePicker) && (
        <EmojiPicker
          includePicker={includePicker}
          myEmojis={myEmojis}
          handleReaction={handleReaction}
          handleRemoveReaction={handleRemoveReaction}
        />
      )}
    </View>
  )
}

const styles = {
  footerReactions: {
    display: 'flex',
    position: 'relative',
    gap: 4,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    height: 'auto',
    flexWrap: 'wrap'
  }
}
