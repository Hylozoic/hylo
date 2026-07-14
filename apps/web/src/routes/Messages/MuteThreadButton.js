import React, { useCallback } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useStore } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { messageThreadUrl, newMessageUrl } from '@hylo/navigation'
import {
  muteMessageThread,
  unmuteMessageThread,
  setThreadTab,
  getMostRecentThreadId,
  THREAD_TAB_INBOX
} from './Messages.store'
import { cn } from 'util/index'

/**
 * Button that mutes or unmutes a message thread after confirmation.
 */
export default function MuteThreadButton ({ threadId, isMuted, className, onComplete }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const store = useStore()
  const navigate = useNavigate()

  const handleClick = useCallback((event) => {
    event?.preventDefault()
    event?.stopPropagation()

    const confirmMessage = isMuted
      ? t('Unmute this conversation? You will start receiving notifications again.')
      : t('Mute this conversation? You will no longer receive notifications from this thread.')
    if (!window.confirm(confirmMessage)) return

    const action = isMuted ? unmuteMessageThread(threadId) : muteMessageThread(threadId)
    dispatch(action).then(() => {
      onComplete?.()

      if (isMuted) {
        dispatch(setThreadTab(THREAD_TAB_INBOX))
        navigate(messageThreadUrl(threadId), { replace: true })
        return
      }

      const nextThreadId = getMostRecentThreadId(store.getState(), { muted: false, excludeId: threadId })
      navigate(
        nextThreadId ? messageThreadUrl(nextThreadId) : newMessageUrl(),
        { replace: true }
      )
    })
  }, [dispatch, isMuted, navigate, onComplete, store, t, threadId])

  return (
    <button
      type='button'
      onClick={handleClick}
      aria-label={isMuted ? t('Unmute conversation') : t('Mute conversation')}
      title={isMuted ? t('Unmute conversation') : t('Mute conversation')}
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-lg transition-all scale-100 hover:scale-105',
        'bg-darkening/20 hover:bg-selected/80 text-foreground/60 hover:text-foreground',
        className
      )}
    >
      {isMuted ? <Bell className='w-4 h-4' /> : <BellOff className='w-4 h-4' />}
    </button>
  )
}
