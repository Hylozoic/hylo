import React, { useMemo, useCallback, useState } from 'react'
import { cn } from 'util/index'
import EmojiPicker from 'components/EmojiPicker'
import EmojiPill from 'components/EmojiPill'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import useReactionActions from 'hooks/useReactionActions'

export default function EmojiRow (props) {
  const {
    alignLeft, // Put the add emoji button on the left side of the emoji row
    className,
    pillClassName, // Extra classes for each reaction pill (e.g. denser chat styling)
    comment,
    currentUser,
    onClick,
    post,
    onAddReaction = () => {},
    onOpenChange = () => {},
    onRemoveReaction = () => {}
  } = props
  const { reactOnEntity, removeReactOnEntity } = useReactionActions()
  const [overflowOpen, setOverflowOpen] = useState(false)

  const entityType = comment ? 'comment' : 'post'
  const myReactions = useMemo(() => (comment
    ? comment.commentReactions?.filter(reaction => reaction.user?.id === currentUser?.id)
    : post.postReactions?.filter(reaction => reaction.user?.id === currentUser?.id)
  ) || [], [comment, post, currentUser])
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

  // Anonymous viewers get counts only — never reactor names in tooltips
  const usersReactions = useMemo(() => entityReactions.reduce((accum, entityReaction) => {
    const name = currentUser ? entityReaction.user?.name : null
    if (accum[entityReaction.emojiFull]) {
      const existing = accum[entityReaction.emojiFull]
      accum[entityReaction.emojiFull] = {
        emojiFull: entityReaction.emojiFull,
        count: existing.count + 1,
        userList: name ? [...existing.userList, name] : existing.userList
      }
    } else {
      accum[entityReaction.emojiFull] = {
        emojiFull: entityReaction.emojiFull,
        count: 1,
        userList: name ? [name] : []
      }
    }

    if (myEmojis.includes(entityReaction.emojiFull)) {
      accum[entityReaction.emojiFull] = { ...accum[entityReaction.emojiFull], loggedInUser: true }
    }

    return accum
  }, {}), [entityReactions, myEmojis, currentUser])

  // Sort reactions by count (most popular first)
  const sortedReactions = useMemo(() =>
    Object.values(usersReactions).sort((a, b) => b.count - a.count),
  [usersReactions])

  const topReaction = sortedReactions[0]
  const overflowReactions = sortedReactions.slice(1)
  const overflowCount = overflowReactions.reduce((sum, r) => sum + r.count, 0)
  const hasAnySelected = overflowReactions.some(r => r.loggedInUser)

  return (
    <div className={cn('hover:scale-105 transition-all hover:z-10 mr-4 inline-block', className)} onClick={onClick}>
      {entityReactions && (
        <div className='transition-all duration-250 ease-in-out flex relative items-center flex-nowrap'>
          {currentUser && alignLeft ? <EmojiPicker handleReaction={handleReaction} myEmojis={myEmojis} handleRemoveReaction={handleRemoveReaction} onOpenChange={onOpenChange} /> : ''}
          {topReaction && (
            <EmojiPill
              onClick={currentUser ? topReaction.loggedInUser ? handleRemoveReaction : handleReaction : null}
              key={topReaction.emojiFull}
              emojiFull={topReaction.emojiFull}
              count={topReaction.count}
              selected={topReaction.loggedInUser}
              toolTip={currentUser ? topReaction.userList.join('<br>') : undefined}
              className={pillClassName}
            />
          )}
          {overflowReactions.length > 0 && (
            <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
              <PopoverTrigger asChild>
                <div
                  className={cn(
                    'relative select-none mr-2 mb-2 text-foreground text-baseline bg-darkening/10 rounded-lg m-1 py-1 px-3 items-center justify-center inline-flex opacity-100 transition-all cursor-pointer hover:bg-selected/50 z-0 hover:z-50 whitespace-nowrap',
                    { 'bg-selected text-foreground': hasAnySelected },
                    pillClassName
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className='sm:hidden'>{overflowReactions.slice(0, 2).map(r => r.emojiFull).join('')}{overflowReactions.length > 2 && '…'}</span>
                  <span className='hidden sm:inline'>{overflowReactions.slice(0, 3).map(r => r.emojiFull).join('')}{overflowReactions.length > 3 && '…'}</span>
                  <span className='ml-1'>{overflowCount}</span>
                </div>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-2' sideOffset={4}>
                <div className='flex flex-wrap'>
                  {overflowReactions.map(reaction => (
                    <EmojiPill
                      onClick={currentUser ? reaction.loggedInUser ? handleRemoveReaction : handleReaction : null}
                      key={reaction.emojiFull}
                      emojiFull={reaction.emojiFull}
                      count={reaction.count}
                      selected={reaction.loggedInUser}
                      toolTip={currentUser ? reaction.userList.join('<br>') : undefined}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {currentUser && !alignLeft ? <EmojiPicker handleReaction={handleReaction} myEmojis={myEmojis} handleRemoveReaction={handleRemoveReaction} onOpenChange={onOpenChange} /> : ''}
        </div>
      )}
    </div>
  )
}
