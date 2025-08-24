import React, { useMemo, useCallback } from 'react'
import { cn } from 'util/index'
import EmojiPicker from 'components/EmojiPicker'
import EmojiPill from 'components/EmojiPill'
import useReactionActions from 'hooks/useReactionActions'

export default function EmojiRow (props) {
  const {
    alignLeft, // Put the add emoji button on the left side of the emoji row
    className,
    comment,
    currentUser,
    onClick,
    post,
    onAddReaction = () => {},
    onOpenChange = () => {},
    onRemoveReaction = () => {}
  } = props
  const { reactOnEntity, removeReactOnEntity } = useReactionActions()

  const entityType = comment ? 'comment' : 'post'
  const myReactions = useMemo(() => (comment ? comment.commentReactions?.filter(reaction => reaction.user.id === currentUser.id) : post.postReactions?.filter(reaction => reaction.user.id === currentUser.id)) || [], [comment, post, currentUser])
  const myEmojis = useMemo(() => myReactions.map((reaction) => reaction.emojiFull), [myReactions])
  const entityReactions = useMemo(() => (comment ? comment.commentReactions : post.postReactions) || [], [comment, post])
  const groupIds = useMemo(() => post.groups.map(g => g.id), [post])

  const handleReaction = useCallback((emojiFull) => {
    onAddReaction(post, emojiFull)
    reactOnEntity({ commentId: comment?.id, emojiFull, entityType, groupIds, postId: post.id })
  }, [comment, post, currentUser, onAddReaction, reactOnEntity, entityType, groupIds])

  const handleRemoveReaction = useCallback((emojiFull) => {
    onRemoveReaction(post, emojiFull)
    removeReactOnEntity({ commentId: comment?.id, emojiFull, entityType, postId: post.id })
  }, [comment, post, currentUser, onRemoveReaction, removeReactOnEntity, entityType, groupIds])

  const usersReactions = useMemo(() => entityReactions.reduce((accum, entityReaction) => {
    if (accum[entityReaction.emojiFull]) {
      const { userList } = accum[entityReaction.emojiFull]
      accum[entityReaction.emojiFull] = { emojiFull: entityReaction.emojiFull, userList: [...userList, entityReaction.user.name] }
    } else {
      accum[entityReaction.emojiFull] = { emojiFull: entityReaction.emojiFull, userList: [entityReaction.user.name] }
    }

    if (myEmojis.includes(entityReaction.emojiFull)) accum[entityReaction.emojiFull] = { ...accum[entityReaction.emojiFull], loggedInUser: true }

    return accum
  }, {}), [entityReactions, myEmojis, currentUser])

  return (
    <div className={cn('hover:scale-105 transition-all hover:z-10 mr-4 inline-block', className)} onClick={onClick}>
      {entityReactions && (
        <div className='transition-all duration-250 ease-in-out flex relative items-center flex-wrap'>
          {currentUser && alignLeft ? <EmojiPicker handleReaction={handleReaction} myEmojis={myEmojis} handleRemoveReaction={handleRemoveReaction} onOpenChange={onOpenChange} /> : ''}
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
          {currentUser && !alignLeft ? <EmojiPicker handleReaction={handleReaction} myEmojis={myEmojis} handleRemoveReaction={handleRemoveReaction} onOpenChange={onOpenChange} /> : ''}
        </div>
      )}
    </div>
  )
}
