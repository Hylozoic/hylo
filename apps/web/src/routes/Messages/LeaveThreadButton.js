import React, { useCallback } from 'react'
import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useStore } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { messageThreadUrl, newMessageUrl } from '@hylo/navigation'
import { leaveMessageThread, getMostRecentThreadId } from './Messages.store'
import { cn } from 'util/index'

/**
 * Button that leaves a message thread after confirmation.
 */
export default function LeaveThreadButton ({ threadId, className, onLeave }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const store = useStore()
  const navigate = useNavigate()

  const handleLeave = useCallback((event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (!window.confirm(t('Leave this conversation? You will stop receiving messages from this thread.'))) return

    dispatch(leaveMessageThread(threadId)).then(() => {
      onLeave?.()
      const nextThreadId = getMostRecentThreadId(store.getState())
      navigate(
        nextThreadId ? messageThreadUrl(nextThreadId) : newMessageUrl(),
        { replace: true }
      )
    })
  }, [dispatch, navigate, onLeave, store, t, threadId])

  return (
    <button
      type='button'
      onClick={handleLeave}
      aria-label={t('Leave conversation')}
      title={t('Leave conversation')}
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-lg transition-all scale-100 hover:scale-105',
        'bg-darkening/20 hover:bg-selected/80 text-foreground/60 hover:text-foreground',
        className
      )}
    >
      <LogOut className='w-4 h-4' />
    </button>
  )
}
