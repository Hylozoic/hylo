import React from 'react'
import { cn } from 'util/index'
import EmojiPicker from 'components/EmojiPicker'
import EmojiPill from 'components/EmojiPill'
import useReactionActions from 'hooks/useReactionActions'

import classes from './EmojiRow.module.scss'

export default function EmojiRow (props) {
  const {
    className,
    comment,
    currentUser,
    onClick,
    post,
    onAddReaction = () => {},
    onRemoveReaction = () => {}
  } = props
  const { reactOnEntity, removeReactOnEntity } = useReactionActions()

  const entityType = comment ? 'comment' : 'post'
  const myReactions = (comment ? comment.myReactions : post.myReactions) || []
  const entityReactions = (comment ? comment.commentReactions : post.postReactions) || []
  const groupIds = post.groups.map(g => g.id)
  const handleReaction = (emojiFull) => {
    onAddReaction(post, emojiFull)
    reactOnEntity({ commentId: comment?.id, emojiFull, entityType, groupIds, postId: post.id })
  }
  const handleRemoveReaction = (emojiFull) => {
    onRemoveReaction(post, emojiFull)
    removeReactOnEntity({ commentId: comment?.id, emojiFull, entityType, postId: post.id })
  }
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
  return (
    <div className={cn('bg-black/20 p-2 rounded-lg mr-2 hover:bg-black/30 transition-all', className)} onClick={onClick}>
      {entityReactions && (
        <div className='transition-all duration-250 ease-in-out flex relative items-center flex-wrap'>
          {Object.values(usersReactions).map(reaction => (
            <EmojiPill
              onClick={currentUser ? reaction.loggedInUser ? handleRemoveReaction : handleReaction : null}
              key={reaction.emojiFull}
              emojiFull={reaction.emojiFull}
              count={reaction.userList.length}
              selected={reaction.loggedInUser}
              toolTip={reaction.userList.join('<br>')}
            />
          ))}
          {currentUser ? <EmojiPicker handleReaction={handleReaction} myEmojis={myEmojis} handleRemoveReaction={handleRemoveReaction} /> : ''}
        </div>
      )}
    </div>
  )
}
