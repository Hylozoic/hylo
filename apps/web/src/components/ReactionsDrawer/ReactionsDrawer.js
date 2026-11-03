import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { personUrl } from '@hylo/navigation'
import Avatar from 'components/Avatar'
import useRouteParams from 'hooks/useRouteParams'
import fetchReactorAvatars from 'store/actions/fetchReactorAvatars'
import { cn } from 'util/index'

export const ALL_REACTIONS = 'all'
const SWIPE_CLOSE_DISTANCE = 80

// Avatars fetched for reactors, shared across drawers so reopening one is instant
const avatarCache = new Map()

// Bottom sheet listing who reacted, per emoji (like WhatsApp / Discord).
// Own entries say "Tap to remove" and remove that reaction; others link to the person's profile.
export default function ReactionsDrawer ({
  open,
  onOpenChange,
  reactions = [],
  currentUser,
  initialEmoji = ALL_REACTIONS,
  onRemoveReaction
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const [selectedEmoji, setSelectedEmoji] = useState(initialEmoji)
  const [avatars, setAvatars] = useState({})
  const [dragY, setDragY] = useState(0)
  const dragStartRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => {
    if (open) setSelectedEmoji(initialEmoji || ALL_REACTIONS)
  }, [open, initialEmoji])

  // Emoji tabs in the same order as the reaction pills (most popular first)
  const emojiGroups = useMemo(() => {
    const groups = {}
    reactions.forEach(reaction => {
      if (!reaction.user) return
      const group = groups[reaction.emojiFull] || (groups[reaction.emojiFull] = { emojiFull: reaction.emojiFull, reactions: [] })
      group.reactions.push(reaction)
    })
    return Object.values(groups)
      .map(group => ({
        ...group,
        // Your own reaction first, like WhatsApp's "You"
        reactions: [...group.reactions].sort((a, b) => (b.user.id === currentUser?.id) - (a.user.id === currentUser?.id))
      }))
      .sort((a, b) => b.reactions.length - a.reactions.length)
  }, [reactions, currentUser?.id])

  const total = emojiGroups.reduce((sum, group) => sum + group.reactions.length, 0)
  const activeGroup = emojiGroups.find(group => group.emojiFull === selectedEmoji)
  const visibleReactions = activeGroup ? activeGroup.reactions : emojiGroups.flatMap(group => group.reactions)

  // Removing a reaction can empty the selected tab (the list then shows All) or the whole drawer
  useEffect(() => {
    if (open && total === 0) onOpenChange(false)
  }, [open, total])

  const personIds = useMemo(() => [...new Set(emojiGroups.flatMap(group => group.reactions.map(r => r.user.id)))], [emojiGroups])

  useEffect(() => {
    if (!open) return
    const missing = personIds.filter(id => id !== currentUser?.id && !avatarCache.has(id))
    const fromCache = () => setAvatars(Object.fromEntries(personIds.filter(id => avatarCache.has(id)).map(id => [id, avatarCache.get(id)])))
    fromCache()
    if (missing.length === 0) return
    let cancelled = false
    Promise.resolve(dispatch(fetchReactorAvatars(missing)))
      .then(result => {
        const people = Object.values(result?.payload?.data || {}).filter(person => person?.id)
        people.forEach(person => avatarCache.set(person.id, person.avatarUrl))
        if (!cancelled && people.length > 0) fromCache()
      })
      // Avatars are decoration — the list works without them
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, personIds.join(',')])

  const avatarFor = user => user.id === currentUser?.id
    ? currentUser.avatarUrl
    : (user.avatarUrl || avatars[user.id])

  const close = () => onOpenChange(false)

  // Swipe down on the handle / header to dismiss
  const handleDragStart = e => { dragStartRef.current = e.touches[0].clientY }
  const handleDragMove = e => {
    if (dragStartRef.current === null) return
    setDragY(Math.max(0, e.touches[0].clientY - dragStartRef.current))
  }
  const handleDragEnd = () => {
    if (dragStartRef.current === null) return
    dragStartRef.current = null
    if (dragY > SWIPE_CLOSE_DISTANCE) close()
    setDragY(0)
  }

  // React events bubble through portals, so taps in the drawer would reach the post/comment/chat
  // click and long-press handlers around the reaction row. Stopping them also stops the native
  // event at the React root, before Radix's document-level outside-tap detection (pointerdown,
  // and on touch the click after it) sees it. So the overlay closes the drawer itself, on click:
  // the tap ends on the still-mounted overlay and never reaches the page underneath.
  const stop = e => e.stopPropagation()
  const stopTouchAndMouse = { onClick: stop, onMouseDown: stop, onTouchStart: stop, onTouchEnd: stop }
  const handleOverlayClick = e => {
    e.stopPropagation()
    close()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid='reactions-drawer-overlay'
          className='fixed inset-0 z-[100] cursor-pointer bg-darkening/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          {...stopTouchAndMouse}
          onPointerDown={stop}
          onClick={handleOverlayClick}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          aria-describedby={undefined}
          data-testid='reactions-drawer'
            // Focus the sheet itself rather than ringing the first tab after a long press
          onOpenAutoFocus={e => { e.preventDefault(); contentRef.current?.focus() }}
          {...stopTouchAndMouse}
          className={cn(
            'fixed inset-x-0 bottom-0 z-[101] mx-auto flex max-h-[75vh] w-full max-w-lg flex-col rounded-t-2xl bg-background text-foreground shadow-xl outline-none',
            'pb-[max(1rem,env(safe-area-inset-bottom))]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-200',
            { 'transition-transform': dragY === 0 }
          )}
          style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        >
          <div
            className='touch-none select-none px-4 pt-2'
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onTouchCancel={handleDragEnd}
          >
            <div className='mx-auto h-1.5 w-10 rounded-full bg-foreground/20' />
            <DialogPrimitive.Title className='pt-4 text-lg font-semibold'>
              {t('reactionCount', { count: total })}
            </DialogPrimitive.Title>
          </div>

          <div role='tablist' aria-label={t('Reactions')} className='flex gap-2 overflow-x-auto px-4 py-3'>
            <ReactionTab selected={!activeGroup} onClick={() => setSelectedEmoji(ALL_REACTIONS)}>
              {t('All')} <span className='text-foreground/70'>{total}</span>
            </ReactionTab>
            {emojiGroups.map(group => (
              <ReactionTab key={group.emojiFull} selected={activeGroup === group} onClick={() => setSelectedEmoji(group.emojiFull)}>
                <span className='text-lg leading-none'>{group.emojiFull}</span> <span className='text-foreground/70'>{group.reactions.length}</span>
              </ReactionTab>
            ))}
          </div>

          <ul className='min-h-0 flex-1 overflow-y-auto px-2' data-testid='reactions-drawer-list'>
            {visibleReactions.map(reaction => {
              const isMe = reaction.user.id === currentUser?.id
              const rowContent = (
                <>
                  <ReactorAvatar avatarUrl={avatarFor(reaction.user)} name={reaction.user.name} />
                  <span className='flex min-w-0 flex-1 flex-col'>
                    <span className='truncate font-medium'>{isMe ? t('You') : reaction.user.name}</span>
                    {isMe && <span className='text-sm text-foreground/60'>{t('Tap to remove')}</span>}
                  </span>
                  <span className='text-2xl leading-none'>{reaction.emojiFull}</span>
                </>
              )
              const rowClassName = 'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-foreground hover:bg-darkening/10 hover:text-foreground focus-visible:bg-darkening/10 focus:outline-none'
              return (
                <li key={reaction.id || `${reaction.user.id}-${reaction.emojiFull}`} data-testid='reactions-drawer-row'>
                  {isMe
                    ? (
                      <button type='button' className={rowClassName} onClick={() => onRemoveReaction(reaction.emojiFull)}>
                        {rowContent}
                      </button>
                      )
                    : (
                      <Link to={personUrl(reaction.user.id, routeParams.groupSlug)} className={rowClassName} onClick={close}>
                        {rowContent}
                      </Link>
                      )}
                </li>
              )
            })}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ReactorAvatar ({ avatarUrl, name }) {
  if (avatarUrl) return <Avatar avatarUrl={avatarUrl} medium className='shrink-0' />
  // Until the avatar loads (or if it can't), show the initial instead of an invisible circle
  return (
    <span aria-hidden className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-darkening/20 text-sm font-semibold text-foreground/70'>
      {name?.[0]?.toUpperCase()}
    </span>
  )
}

function ReactionTab ({ selected, onClick, children }) {
  return (
    <button
      type='button'
      role='tab'
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm text-foreground transition-colors',
        selected ? 'bg-selected/60' : 'bg-darkening/10 hover:bg-darkening/20'
      )}
    >
      {children}
    </button>
  )
}
