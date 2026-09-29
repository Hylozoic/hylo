import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { filter, get } from 'lodash/fp'
import { Ban, Flag, LogOut, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useStore } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { messageThreadUrl, newMessageUrl } from '@hylo/navigation'
import FlagContent from 'components/FlagContent/FlagContent'
import Icon from 'components/Icon'
import ProfileCardDialog from 'components/ProfileCardDialog/ProfileCardDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import blockUser from 'store/actions/blockUser'
import { others } from 'store/models/MessageThread'
import { AXOLOTL_ID } from 'store/models/Person'
import { cn } from 'util/index'
import MuteThreadButton from '../MuteThreadButton'
import { getMostRecentThreadId, leaveMessageThread } from '../Messages.store'

const MEASURE_GAP = 8 // gap-2 = 0.5rem = 8px
const OTHERS_RESERVE = 100 // reserve space for "N others ▼" pill

export default function Header ({ currentUser, messageThread, pending, threadId }) {
  const [showAll, setShowAll] = useState(false)
  const [maxVisible, setMaxVisible] = useState(null)
  const containerRef = useRef(null)
  const measuringRef = useRef(null)

  const participants = get('participants', messageThread) || []
  const otherParticipants = useMemo(() => {
    if (!currentUser) return participants
    return filter(p => p.id !== currentUser.id, participants)
  }, [participants, currentUser])

  // Reset when thread changes
  useEffect(() => {
    setShowAll(false)
    setMaxVisible(null)
  }, [threadId])

  // Measure how many name pills fit on one line
  const measure = useCallback(() => {
    if (showAll || !measuringRef.current || !containerRef.current) return

    const containerWidth = containerRef.current.offsetWidth
    const pills = Array.from(measuringRef.current.children)
    if (pills.length === 0) return

    let usedWidth = 0
    let count = 0

    for (let i = 0; i < pills.length; i++) {
      const pillWidth = pills[i].offsetWidth
      const widthWithPill = usedWidth + pillWidth + (count > 0 ? MEASURE_GAP : 0)
      const isLast = i === pills.length - 1

      // If this is the last pill, just check it fits
      // Otherwise reserve space for the "X others" pill
      const totalNeeded = isLast ? widthWithPill : widthWithPill + MEASURE_GAP + OTHERS_RESERVE

      if (totalNeeded > containerWidth && count > 0) break

      usedWidth = widthWithPill
      count++
    }

    setMaxVisible(count >= pills.length ? null : Math.max(1, count))
  }, [showAll, otherParticipants])

  // Re-measure on mount, resize, and participant changes
  useEffect(() => {
    if (showAll) return
    const raf = requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [measure, showAll])

  if (pending) return null

  const noOthers = otherParticipants.length === 0
  const displayParticipants = showAll || maxVisible === null
    ? otherParticipants
    : otherParticipants.slice(0, maxVisible)
  const hiddenCount = otherParticipants.length - displayParticipants.length

  const toggleShowAll = () => setShowAll(prev => !prev)

  return (
    <div className='flex w-full text-foreground min-w-0 relative overflow-hidden' id='thread-header' ref={containerRef}>
      {/* Hidden measuring container — renders all pills to get their widths */}
      {!showAll && (
        <div
          ref={measuringRef}
          className='flex gap-2 absolute top-0 left-0 invisible pointer-events-none'
          aria-hidden='true'
        >
          {otherParticipants.map(p => (
            <span key={p.id} className='font-bold whitespace-nowrap p-1.5 sm:p-2 rounded text-xs sm:text-sm'>{p.name}</span>
          ))}
        </div>
      )}

      <div className={cn(
        'text-foreground flex gap-2 min-w-0 flex-1 items-center',
        showAll ? 'flex-wrap' : 'flex-nowrap overflow-hidden')}
      >
        {noOthers
          ? (
            <ProfileCardDialog personId={currentUser.id}>
              <span className='text-foreground font-bold inline-block p-1.5 sm:p-2 rounded bg-darkening/20 text-xs sm:text-sm whitespace-nowrap transition-all hover:bg-selected/50 hover:scale-105 hover:text-foreground'>
                You
              </span>
            </ProfileCardDialog>
            )
          : (
            <>
              {displayParticipants.map(p => (
                <ProfileCardDialog key={p.id} personId={p.id}>
                  <span className='text-foreground font-bold inline-block p-1.5 sm:p-2 rounded bg-darkening/20 text-xs sm:text-sm whitespace-nowrap transition-all hover:bg-selected/50 hover:scale-105 hover:text-foreground'>
                    {p.name}
                  </span>
                </ProfileCardDialog>
              ))}
              {hiddenCount > 0 && !showAll && (
                <span
                  className='text-foreground text-xs sm:text-sm p-1.5 sm:p-2 bg-darkening/20 rounded flex items-center whitespace-nowrap transition-all hover:bg-selected/50 hover:scale-105 hover:text-foreground hover:cursor-pointer flex-shrink-0'
                  onClick={toggleShowAll}
                >
                  {others(hiddenCount)}
                  <Icon name='ArrowDown' className='text-foreground ml-1' />
                </span>
              )}
              {showAll && (
                <span
                  className='text-foreground text-xs sm:text-sm p-1.5 sm:p-2 bg-darkening/20 rounded flex items-center whitespace-nowrap transition-all hover:bg-selected/50 hover:scale-105 hover:text-foreground hover:cursor-pointer flex-shrink-0'
                  onClick={toggleShowAll}
                >
                  Show Less
                  <Icon name='ArrowUp' className='text-foreground ml-1' />
                </span>
              )}
            </>
            )}
      </div>
      {threadId && threadId !== 'new' && (
        <MuteThreadButton
          threadId={threadId}
          isMuted={!!messageThread?.isMuted}
          className='flex-shrink-0 ml-2'
        />
      )}
      {threadId && threadId !== 'new' && (
        <ThreadActionsMenu
          threadId={threadId}
          otherParticipants={otherParticipants}
        />
      )}
    </div>
  )
}

/**
 * Safety actions for a conversation, in this order: Block (the fastest relief),
 * Report to Hylo staff, then Leave conversation.
 */
export function ThreadActionsMenu ({ threadId, otherParticipants = [] }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const store = useStore()
  const navigate = useNavigate()
  const [reporting, setReporting] = useState(false)

  const goToNextThread = useCallback(() => {
    const nextThreadId = getMostRecentThreadId(store.getState(), { excludeId: threadId })
    navigate(nextThreadId ? messageThreadUrl(nextThreadId) : newMessageUrl(), { replace: true })
  }, [navigate, store, threadId])

  const handleBlock = useCallback(person => {
    if (!window.confirm(t('blockInConversationConfirm', { name: person.name }))) return
    dispatch(blockUser(person.id)).then(result => {
      if (result?.error) return
      toast.success(t('You blocked {{name}}', { name: person.name }))
      goToNextThread()
    })
  }, [dispatch, goToNextThread, t])

  const handleLeave = useCallback(() => {
    if (!window.confirm(t('leaveConversationConfirm'))) return
    dispatch(leaveMessageThread(threadId)).then(result => {
      if (result?.error) return
      goToNextThread()
    })
  }, [dispatch, goToNextThread, t, threadId])

  // In a one-to-one conversation the report is about the other person
  const reportedUserId = otherParticipants.length === 1 ? otherParticipants[0].id : undefined
  const blockable = otherParticipants.filter(person => String(person.id) !== String(AXOLOTL_ID))

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            aria-label={t('Conversation options')}
            data-testid='thread-actions-trigger'
            className='flex-shrink-0 ml-2 flex items-center justify-center w-7 h-7 rounded-lg transition-all scale-100 hover:scale-105 bg-darkening/20 hover:bg-selected/80 text-foreground/60 hover:text-foreground'
          >
            <MoreHorizontal className='w-4 h-4' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-[200px]' data-testid='thread-actions-menu'>
          {blockable.map(person => (
            <DropdownMenuItem key={person.id} onClick={() => handleBlock(person)} className='flex items-center gap-2' data-testid='thread-action-block'>
              <Ban className='w-4 h-4 text-destructive' />
              <span>{t('Block {{name}}', { name: person.name })}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => setReporting(true)} className='flex items-center gap-2' data-testid='thread-action-report'>
            <Flag className='w-4 h-4' />
            <span>{t('Report to Hylo')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLeave} className='flex items-center gap-2' data-testid='thread-action-leave'>
            <LogOut className='w-4 h-4' />
            <span>{t('Leave conversation')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {reporting && (
        <FlagContent
          type={t('conversation')}
          linkData={{ id: threadId, type: 'thread', reportedUserId }}
          onClose={() => setReporting(false)}
        />
      )}
    </>
  )
}
