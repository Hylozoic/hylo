import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import Loading from 'components/Loading'
import { cn } from 'util/index'
import { isPhoneDevice } from 'util/mobile'
import Messages from './Messages'
import ThreadList from './ThreadList'

const THREADLIST_WIDTH_KEY = 'hylo-messages-threadlist-width'
const MIN_LIST_WIDTH = 240
const MAX_LIST_WIDTH = 520
const DEFAULT_LIST_WIDTH = 300

/**
 * On phones, ThreadList lives in the nav drawer and Messages fills the center column.
 * On tablet/desktop, ThreadList and Messages sit side-by-side in the center column,
 * split by a draggable divider that resizes both (persisted per browser).
 */
export default function MessagesLayout () {
  const { t } = useTranslation()
  const { messageThreadId: rawMessageThreadId } = useParams()
  // `/messages/create/...` matches `:messageThreadId` as "create"; treat that as no thread
  const messageThreadId = rawMessageThreadId === 'create' ? undefined : rawMessageThreadId

  const [listWidth, setListWidth] = useState(() => {
    const saved = parseInt(window.localStorage.getItem(THREADLIST_WIDTH_KEY), 10)
    return Number.isFinite(saved)
      ? Math.min(Math.max(saved, MIN_LIST_WIDTH), MAX_LIST_WIDTH)
      : DEFAULT_LIST_WIDTH
  })
  const [resizing, setResizing] = useState(false)
  const dragRef = useRef(null)

  const onDividerPointerDown = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startWidth: listWidth }
    setResizing(true)
  }, [listWidth])

  const onDividerPointerMove = useCallback((e) => {
    const drag = dragRef.current
    if (!drag) return
    const next = Math.min(Math.max(drag.startWidth + e.clientX - drag.startX, MIN_LIST_WIDTH), MAX_LIST_WIDTH)
    setListWidth(next)
  }, [])

  const onDividerPointerUp = useCallback(() => {
    if (!dragRef.current) return
    dragRef.current = null
    setResizing(false)
    setListWidth(width => {
      window.localStorage.setItem(THREADLIST_WIDTH_KEY, String(Math.round(width)))
      return width
    })
  }, [])

  if (isPhoneDevice()) {
    if (!messageThreadId) return <Loading />
    return <Messages />
  }

  return (
    <div className='flex flex-row flex-1 min-h-0 w-full h-full overflow-hidden'>
      <div style={{ width: listWidth }} className='shrink-0 h-full min-h-0 flex'>
        <ThreadList />
      </div>
      {/* Divider: dragging resizes the inbox, the conversation takes the rest */}
      <div
        role='separator'
        aria-orientation='vertical'
        aria-label={t('Adjust inbox width')}
        className={cn(
          'shrink-0 w-1.5 h-full touch-none select-none transition-colors',
          resizing ? 'bg-foreground/20 cursor-grabbing' : 'bg-transparent hover:bg-foreground/15 cursor-col-resize'
        )}
        onPointerDown={onDividerPointerDown}
        onPointerMove={onDividerPointerMove}
        onPointerUp={onDividerPointerUp}
        onPointerCancel={onDividerPointerUp}
      />
      <div className='flex flex-col flex-1 min-w-0 min-h-0 h-full'>
        {messageThreadId ? <Messages /> : <Loading />}
      </div>
    </div>
  )
}
